<?php

// backend/app/Notifications/DailySummaryNotification.php
// Purpose: Sent nightly at 21:00 with today's revenue, orders, profit, and alerts.

namespace App\Notifications;

use App\Notifications\Channels\AfricasTalkingSmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DailySummaryNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array{name: string, revenue: float}|null  $topProduct
     */
    public function __construct(
        public readonly string $shopName,
        public readonly string $ownerName,
        public readonly string $date,
        public readonly float $todayRevenue,
        public readonly int $todayOrders,
        public readonly float $todayProfit,
        public readonly ?array $topProduct,
        public readonly int $lowStockCount,
    ) {}

    /**
     * @param  mixed  $notifiable
     * @return array<int, string|class-string>
     */
    public function via(mixed $notifiable): array
    {
        $channels = ['database'];

        $prefs = $notifiable->shop?->notification_preferences['daily_summary'] ?? [];

        if (! empty($prefs['email'])) {
            $channels[] = 'mail';
        }

        if (! empty($prefs['sms'])) {
            $channels[] = AfricasTalkingSmsChannel::class;
        }

        return $channels;
    }

    /**
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    public function toDatabase(mixed $notifiable): array
    {
        return [
            'type' => 'daily_summary',
            'title' => "Daily summary — {$this->date}",
            'message' => "Revenue: KES ".number_format($this->todayRevenue, 2)." · {$this->todayOrders} orders · Profit: KES ".number_format($this->todayProfit, 2),
            'data' => [
                'shopName' => $this->shopName,
                'date' => $this->date,
                'todayRevenue' => $this->todayRevenue,
                'todayOrders' => $this->todayOrders,
                'todayProfit' => $this->todayProfit,
                'topProduct' => $this->topProduct,
                'lowStockCount' => $this->lowStockCount,
            ],
        ];
    }

    /**
     * @param  mixed  $notifiable
     */
    public function toMail(mixed $notifiable): MailMessage
    {
        $html = $this->renderEmailTemplate('daily-summary', [
            'shopName' => $this->shopName,
            'ownerName' => $this->ownerName,
            'date' => $this->date,
            'todayRevenue' => $this->todayRevenue,
            'todayOrders' => $this->todayOrders,
            'todayProfit' => $this->todayProfit,
            'topProduct' => $this->topProduct,
            'lowStockCount' => $this->lowStockCount,
            'dashboardUrl' => config('app.frontend_url').'/dashboard',
        ]);

        return (new MailMessage)
            ->subject("Your SmartKiosk daily summary — {$this->date}")
            ->html($html);
    }

    /**
     * SMS payload — ≤160 characters.
     *
     * @param  mixed  $notifiable
     */
    public function toSms(mixed $notifiable): string
    {
        $revenue = number_format($this->todayRevenue, 0);
        $msg = "[SmartKiosk] {$this->date}: KES {$revenue} revenue, {$this->todayOrders} orders. Check dashboard for details.";

        return mb_strlen($msg) > 155 ? mb_substr($msg, 0, 155).'…' : $msg;
    }

    /**
     * @param  string  $template
     * @param  array<string, mixed>  $data
     */
    private function renderEmailTemplate(string $template, array $data): string
    {
        try {
            $response = Http::withToken(config('services.email_render.secret'))
                ->post(config('app.frontend_url').'/api/emails/render', [
                    'template' => $template,
                    'data' => $data,
                ]);

            if ($response->successful()) {
                /** @var array{html?: string} $body */
                $body = $response->json();

                return $body['html'] ?? '';
            }

            Log::warning('Email render endpoint returned non-2xx', [
                'status' => $response->status(),
                'template' => $template,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to render email template', [
                'template' => $template,
                'error' => $e->getMessage(),
            ]);
        }

        return "<p>Daily summary for {$this->date}: KES ".number_format($this->todayRevenue, 2)." revenue, {$this->todayOrders} orders.</p>";
    }
}
