<?php

// backend/app/Notifications/LowStockNotification.php
// Purpose: Sent when a product's quantity falls at or below its reorder level.

namespace App\Notifications;

use App\Notifications\Channels\AfricasTalkingSmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

use Illuminate\Notifications\Messages\BroadcastMessage;

class LowStockNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $productName,
        public readonly float $currentQuantity,
        public readonly float $reorderLevel,
        public readonly string $shopName,
        public readonly string $productId = '',
    ) {}

    /**
     * Determine channels based on shop notification preferences.
     *
     * @param  mixed  $notifiable
     * @return array<int, string|class-string>
     */
    public function via(mixed $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        $prefs = $notifiable->shop?->notification_preferences['low_stock'] ?? [];

        if (! empty($prefs['email'])) {
            $channels[] = 'mail';
        }

        if (! empty($prefs['sms'])) {
            $channels[] = AfricasTalkingSmsChannel::class;
        }

        return $channels;
    }

    /**
     * Database notification payload.
     *
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    public function toDatabase(mixed $notifiable): array
    {
        return [
            'type' => 'low_stock',
            'title' => "Low stock: {$this->productName}",
            'message' => "{$this->currentQuantity} units left · reorder at {$this->reorderLevel}",
            'data' => [
                'productId' => $this->productId,
                'productName' => $this->productName,
                'currentQuantity' => $this->currentQuantity,
                'reorderLevel' => $this->reorderLevel,
                'shopName' => $this->shopName,
            ],
        ];
    }

    /**
     * Broadcast notification payload.
     *
     * @param  mixed  $notifiable
     */
    public function toBroadcast(mixed $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'id' => $this->id,
            'type' => 'low_stock',
            'title' => "Low stock: {$this->productName}",
            'message' => "{$this->currentQuantity} units left · reorder at {$this->reorderLevel}",
            'data' => [
                'productId' => $this->productId,
                'productName' => $this->productName,
                'currentQuantity' => $this->currentQuantity,
                'reorderLevel' => $this->reorderLevel,
                'shopName' => $this->shopName,
            ],
            'createdAt' => now()->toIso8601String(),
        ]);
    }

    /**
     * Email notification — renders React Email template via Next.js render endpoint.
     *
     * @param  mixed  $notifiable
     */
    public function toMail(mixed $notifiable): MailMessage
    {
        $html = $this->renderEmailTemplate('low-stock', [
            'shopName' => $this->shopName,
            'productName' => $this->productName,
            'currentQuantity' => $this->currentQuantity,
            'reorderLevel' => $this->reorderLevel,
            'stockInUrl' => config('app.frontend_url').'/dashboard/inventory',
        ]);

        return (new MailMessage)
            ->subject("Low stock: {$this->productName}")
            ->html($html);
    }

    /**
     * SMS payload — ≤160 characters.
     *
     * @param  mixed  $notifiable
     */
    public function toSms(mixed $notifiable): string
    {
        $msg = "[SmartKiosk] Low stock: {$this->productName} — {$this->currentQuantity} units left. Reorder at {$this->reorderLevel}.";

        return mb_strlen($msg) > 155 ? mb_substr($msg, 0, 155).'…' : $msg;
    }

    /**
     * Fetch rendered HTML from the Next.js email render endpoint.
     *
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

        // Fallback: plain text body
        return "<p>Low stock alert: <strong>{$this->productName}</strong> has {$this->currentQuantity} units remaining (reorder at {$this->reorderLevel}).</p>";
    }
}
