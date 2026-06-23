<?php

// backend/app/Notifications/SyncFailedNotification.php
// Purpose: Sent to the shop owner when the client sync queue has been stuck for more than 1 hour.

namespace App\Notifications;

use App\Notifications\Channels\AfricasTalkingSmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

use Illuminate\Notifications\Messages\BroadcastMessage;

class SyncFailedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $pendingCount,
        public readonly string $oldestPendingAt,
    ) {}

    /**
     * @param  mixed  $notifiable
     * @return array<int, string|class-string>
     */
    public function via(mixed $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        $prefs = $notifiable->shop?->notification_preferences['sync_failed'] ?? [];

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
            'type' => 'sync_failed',
            'title' => 'Sync queue stuck',
            'message' => "{$this->pendingCount} pending operation(s) stuck since {$this->oldestPendingAt}",
            'data' => [
                'pendingCount' => $this->pendingCount,
                'oldestPendingAt' => $this->oldestPendingAt,
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
            'type' => 'sync_failed',
            'title' => 'Sync queue stuck',
            'message' => "{$this->pendingCount} pending operation(s) stuck since {$this->oldestPendingAt}",
            'data' => [
                'pendingCount' => $this->pendingCount,
                'oldestPendingAt' => $this->oldestPendingAt,
            ],
            'createdAt' => now()->toIso8601String(),
        ]);
    }

    /**
     * @param  mixed  $notifiable
     */
    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('SmartKiosk sync queue is stuck')
            ->line("Your sync queue has {$this->pendingCount} pending operation(s) that have been stuck since {$this->oldestPendingAt}.")
            ->line('Please check your internet connection and reopen the app to retry.')
            ->action('Open Dashboard', config('app.frontend_url').'/dashboard');
    }

    /**
     * SMS payload — ≤160 characters.
     *
     * @param  mixed  $notifiable
     */
    public function toSms(mixed $notifiable): string
    {
        $msg = "[SmartKiosk] Sync stuck: {$this->pendingCount} pending operations since {$this->oldestPendingAt}. Open app to retry.";

        return mb_strlen($msg) > 155 ? mb_substr($msg, 0, 155).'…' : $msg;
    }
}
