<?php

// backend/app/Notifications/SaleVoidedNotification.php
// Purpose: Sent to the shop owner when a manager or cashier voids a completed sale.

namespace App\Notifications;

use App\Notifications\Channels\AfricasTalkingSmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SaleVoidedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<int, array{name: string, quantity: float, total: float}>  $items
     */
    public function __construct(
        public readonly string $receiptNumber,
        public readonly float $total,
        public readonly string $voidedBy,
        public readonly string $voidedAt,
        public readonly array $items,
        public readonly string $shopName,
    ) {}

    /**
     * @param  mixed  $notifiable
     * @return array<int, string|class-string>
     */
    public function via(mixed $notifiable): array
    {
        $channels = ['database'];

        $prefs = $notifiable->shop?->notification_preferences['sale_voided'] ?? [];

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
            'type' => 'sale_voided',
            'title' => "Sale voided — {$this->receiptNumber}",
            'message' => "KES ".number_format($this->total, 2)." voided by {$this->voidedBy}",
            'data' => [
                'shopName' => $this->shopName,
                'receiptNumber' => $this->receiptNumber,
                'total' => $this->total,
                'voidedBy' => $this->voidedBy,
                'voidedAt' => $this->voidedAt,
                'items' => $this->items,
            ],
        ];
    }

    /**
     * @param  mixed  $notifiable
     */
    public function toMail(mixed $notifiable): MailMessage
    {
        $html = $this->renderEmailTemplate('sale-voided', [
            'shopName' => $this->shopName,
            'receiptNumber' => $this->receiptNumber,
            'totalAmount' => $this->total,
            'voidedBy' => $this->voidedBy,
            'voidedAt' => $this->voidedAt,
            'items' => $this->items,
            'dashboardUrl' => config('app.frontend_url').'/dashboard/sales',
        ]);

        return (new MailMessage)
            ->subject("Sale voided — {$this->receiptNumber}")
            ->html($html);
    }

    /**
     * SMS payload — ≤160 characters.
     *
     * @param  mixed  $notifiable
     */
    public function toSms(mixed $notifiable): string
    {
        $total = number_format($this->total, 2);
        $msg = "[SmartKiosk] Sale {$this->receiptNumber} (KES {$total}) was voided by {$this->voidedBy}.";

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

        return "<p>Sale <strong>{$this->receiptNumber}</strong> (KES ".number_format($this->total, 2).") was voided by {$this->voidedBy}.</p>";
    }
}
