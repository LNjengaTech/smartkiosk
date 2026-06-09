<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/MpesaController.php
// Purpose: Handles M-Pesa STK Push payments, Safaricom sandbox IP validated
//          callbacks, and polling for status updates.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class MpesaController extends Controller
{
    use ApiResponse;

    private string $consumerKey;
    private string $consumerSecret;
    private string $passkey;
    private string $shortcode;
    private string $baseUrl;

    public function __construct()
    {
        $this->consumerKey = env('MPESA_CONSUMER_KEY', 'default_key');
        $this->consumerSecret = env('MPESA_CONSUMER_SECRET', 'default_secret');
        $this->passkey = env('MPESA_PASSKEY', 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'); // Sandbox standard passkey
        $this->shortcode = env('MPESA_SHORTCODE', '174379'); // Sandbox standard Lipa Na Mpesa shortcode
        $this->baseUrl = 'https://sandbox.safaricom.co.ke';
    }

    /**
     * POST /api/v1/payments/mpesa/stk-push
     * Trigger STK push to customer's phone
     */
    public function stkPush(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => ['required', 'string'],
            'amount' => ['required', 'numeric', 'min:1'],
            'account_reference' => ['required', 'string', 'max:50'],
        ]);

        $phone = $this->formatPhoneNumber($request->input('phone'));
        $amount = (int) $request->input('amount');
        $reference = $request->input('account_reference');

        try {
            $token = $this->getAccessToken();
            $timestamp = Carbon::now()->format('YmdHis');
            $password = base64_encode($this->shortcode . $this->passkey . $timestamp);

            // Using standard public ngrok/expose url fallback for local testing callback
            $callbackUrl = env('MPESA_CALLBACK_URL', url('/api/v1/payments/mpesa/callback'));

            $response = Http::withToken($token)
                ->post($this->baseUrl . '/mpesa/stkpush/v1/processrequest', [
                    'BusinessShortCode' => $this->shortcode,
                    'Password' => $password,
                    'Timestamp' => $timestamp,
                    'TransactionType' => 'CustomerPayBillOnline',
                    'Amount' => $amount,
                    'PartyA' => $phone,
                    'PartyB' => $this->shortcode,
                    'PhoneNumber' => $phone,
                    'CallBackURL' => $callbackUrl,
                    'AccountReference' => $reference,
                    'TransactionDesc' => 'POS Kiosk Payment',
                ]);

            if ($response->failed()) {
                Log::error('M-Pesa STK Push API failed:', $response->json() ?: []);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to initiate STK Push with Safaricom.',
                ], 502);
            }

            $resData = $response->json();
            $checkoutRequestId = $resData['CheckoutRequestID'] ?? null;

            if (!$checkoutRequestId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Safaricom did not return a Checkout Request ID.',
                ], 502);
            }

            // Set initial state in Cache for polling (expires in 10 minutes)
            Cache::put("mpesa:{$checkoutRequestId}", [
                'status' => 'pending',
                'checkoutRequestId' => $checkoutRequestId,
            ], 600);

            return $this->success([
                'checkoutRequestId' => $checkoutRequestId,
                'message' => 'STK Push sent. Please check your phone for the PIN prompt.',
            ], 'STK Push initiated successfully.');

        } catch (\Exception $e) {
            Log::error('M-Pesa STK Push exception: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'M-Pesa integration error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/v1/payments/mpesa/callback
     * Public endpoint to receive Safaricom STK Push callback.
     * Exclude from Sanctum auth & CSRF.
     */
    public function callback(Request $request): JsonResponse
    {
        // 1. Enforce Safaricom Sandbox IP range (196.201.214.0/24)
        $ip = $request->ip();
        if (!$this->isSafaricomIp($ip)) {
            Log::warning("Unauthorized M-Pesa callback attempt from IP: {$ip}");
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Unauthorized callback source.',
            ], 403);
        }

        $payload = $request->json()->all();
        Log::info('M-Pesa callback received:', $payload);

        $stkCallback = $payload['Body']['stkCallback'] ?? null;
        if (!$stkCallback) {
            return response()->json(['success' => false, 'message' => 'Invalid callback body'], 400);
        }

        $checkoutRequestId = $stkCallback['CheckoutRequestID'] ?? null;
        $resultCode = (int) ($stkCallback['ResultCode'] ?? -1);
        $resultDesc = $stkCallback['ResultDesc'] ?? 'Failed';

        if (!$checkoutRequestId) {
            return response()->json(['success' => false, 'message' => 'Missing CheckoutRequestID'], 400);
        }

        if ($resultCode === 0) {
            // Success payment
            $callbackMetadata = $stkCallback['CallbackMetadata']['Item'] ?? [];
            $mpesaReceiptNumber = '';
            
            foreach ($callbackMetadata as $item) {
                if ($item['Name'] === 'MpesaReceiptNumber') {
                    $mpesaReceiptNumber = $item['Value'] ?? '';
                    break;
                }
            }

            Cache::put("mpesa:{$checkoutRequestId}", [
                'status' => 'success',
                'mpesaReceiptNumber' => $mpesaReceiptNumber,
                'checkoutRequestId' => $checkoutRequestId,
            ], 600);

            Log::info("M-Pesa Payment Success: Ref={$mpesaReceiptNumber}, ID={$checkoutRequestId}");
        } else {
            // Failed payment / cancelled by user
            Cache::put("mpesa:{$checkoutRequestId}", [
                'status' => 'failed',
                'message' => $resultDesc,
                'checkoutRequestId' => $checkoutRequestId,
            ], 600);

            Log::info("M-Pesa Payment Failed: Desc={$resultDesc}, ID={$checkoutRequestId}");
        }

        return response()->json(['success' => true, 'message' => 'Callback processed']);
    }

    /**
     * GET /api/v1/payments/mpesa/status/{checkoutRequestId}
     * Check if payment is successful or failed (polling target)
     */
    public function status(string $checkoutRequestId): JsonResponse
    {
        $statusData = Cache::get("mpesa:{$checkoutRequestId}");

        if (!$statusData) {
            return response()->json([
                'success' => false,
                'message' => 'Transaction not found or expired.',
                'data' => ['status' => 'expired']
            ], 404);
        }

        return $this->success($statusData, 'Transaction status retrieved.');
    }

    /**
     * Helper to get OAuth token
     */
    private function getAccessToken(): string
    {
        $response = Http::withBasicAuth($this->consumerKey, $this->consumerSecret)
            ->get($this->baseUrl . '/oauth/v1/generate', [
                'grant_type' => 'client_credentials',
            ]);

        if ($response->failed()) {
            throw new \RuntimeException('Failed to fetch Safaricom OAuth token.');
        }

        return $response->json()['access_token'];
    }

    /**
     * Format phone number to 254XXXXXXXXX format
     */
    private function formatPhoneNumber(string $phone): string
    {
        $clean = preg_replace('/\D/', '', $phone);
        if (str_starts_with($clean, '0')) {
            return '254' . substr($clean, 1);
        }
        if (str_starts_with($clean, '7') || str_starts_with($clean, '1')) {
            return '254' . $clean;
        }
        return $clean;
    }

    /**
     * Validate Sandbox Safaricom IP ranges (196.201.214.0/24 or standard localhost/debug override)
     */
    private function isSafaricomIp(?string $ip): bool
    {
        if (app()->environment('local', 'testing') && ($ip === '127.0.0.1' || $ip === '::1')) {
            return true;
        }

        if (!$ip) return false;

        // Sandbox Safaricom IP range: 196.201.214.0 - 196.201.214.255
        $subnet = '196.201.214.0';
        $mask = 24;

        $ip_dec = ip2long($ip);
        $subnet_dec = ip2long($subnet);
        $wildcard_dec = pow(2, (32 - $mask)) - 1;
        $netmask_dec = ~$wildcard_dec;

        return (($ip_dec & $netmask_dec) === ($subnet_dec & $netmask_dec));
    }
}
