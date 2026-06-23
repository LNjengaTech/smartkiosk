<?php

// backend/app/Notifications/ExpiryAlertNotification.php
// Purpose: Sent when one or more products are expiring within the next 7 days.

namespace App\Notifications;

use App\Notifications\Channels\AfricasTalkingSmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpiryAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<int, array{name: string, expiryDate: string, daysRemaining: int, quantity: float}>  $products
     */
    public function __construct(
        public readonly array $products,
        public readonly string $shopName,
    ) {}

    /**
     * @param  mixed  $notifiable
     * @return array<int, string|class-string>
     */
    public function via(mixed $notifiable): array
    {
        $channels = ['database'];

        $prefs = $notifiable->shop?->notification_preferences['expiry_alert'] ?? [];

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
        $count = count($this->products);
        $first = $this->products[0] ?? null;

        $message = $count === 1 && $first !== null
            ? "{$first['name']} expires in {$first['daysRemaining']} day(s)"
            : "{$count} products expiring within 7 days";

        return [
            'type' => 'expiry_alert',
            'title' => 'Expiry alert',
            'message' => $message,
            'data' => [
                'shopName' => $this->shopName,
                'productCount' => $count,
                'products' => $this->products,
            ],
        ];
    }

    /**
     * @param  mixed  $notifiable
     */
    public function toMail(mixed $notifiable): MailMessage
    {
        $html = $this->renderEmailTemplate('expiry-alert', [
            'shopName' => $this->shopName,
            'products' => $this->products,
            'dashboardUrl' => config('app.frontend_url').'/dashboard/inventory',
        ]);

        $count = count($this->products);

        return (new MailMessage)
            ->subject("Expiry alert — {$count} product(s) expiring soon at {$this->shopName}")
            ->html($html);
    }

    /**
     * SMS payload — ≤160 characters.
     *
     * @param  mixed  $notifiable
     */
    public function toSms(mixed $notifiable): string
    {
        $count = count($this->products);
        $msg = "[SmartKiosk] {$count} product(s) expiring within 7 days at {$this->shopName}. Check your inventory.";

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

        $count = count($this->products);

        return "<p>Expiry alert: <strong>{$count} product(s)</strong> expiring within 7 days at {$this->shopName}.</p>";
    }
}
