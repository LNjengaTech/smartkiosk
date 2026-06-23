<?php

// backend/app/Services/AfricasTalkingService.php
// Purpose: Wraps the Africa's Talking SMS SDK for single-message delivery (≤160 chars).

namespace App\Services;

use AfricasTalking\SDK\AfricasTalking;
use Illuminate\Support\Facades\Log;

class AfricasTalkingService
{
    private readonly \AfricasTalking\SDK\SMS $sms;

    public function __construct(
        private readonly string $username,
        private readonly string $apiKey,
    ) {
        $sdk = new AfricasTalking($this->username, $this->apiKey);
        $this->sms = $sdk->sms();
    }

    /**
     * Send an SMS message to the given phone number.
     * Phone number must be in E.164 format, e.g. +254712345678.
     */
    public function send(string $phone, string $message): void
    {
        $safeMessage = $this->truncate($message);

        try {
            $result = $this->sms->send([
                'to' => $phone,
                'message' => $safeMessage,
            ]);

            Log::info('AfricasTalking SMS sent', [
                'phone' => $phone,
                'result' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('AfricasTalking SMS failed', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Truncate message to a maximum length, appending an ellipsis if truncated.
     * Defaults to 155 to stay safely within the 160-character single-message limit.
     */
    public function truncate(string $text, int $max = 155): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }

        return mb_substr($text, 0, $max).'…';
    }
}
