<?php

// backend/app/Notifications/Channels/AfricasTalkingSmsChannel.php
// Purpose: Custom Laravel notification channel that delivers SMS via Africa's Talking.

namespace App\Notifications\Channels;

use App\Services\AfricasTalkingService;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class AfricasTalkingSmsChannel
{
    public function __construct(
        private readonly AfricasTalkingService $smsService,
    ) {}

    /**
     * Send the given notification via Africa's Talking SMS.
     */
    public function send(mixed $notifiable, Notification $notification): void
    {
        // Skip if the notification doesn't implement toSms()
        if (! method_exists($notification, 'toSms')) {
            return;
        }

        // Resolve phone number from the notifiable model
        $phone = $notifiable->phone ?? $notifiable->shop?->phone ?? null;

        if (empty($phone)) {
            Log::info('AfricasTalkingSmsChannel: No phone number found, skipping SMS.', [
                'notification' => get_class($notification),
                'notifiable_id' => $notifiable->id ?? 'unknown',
            ]);

            return;
        }

        /** @var string $message */
        $message = $notification->toSms($notifiable);

        $this->smsService->send((string) $phone, $message);
    }
}
