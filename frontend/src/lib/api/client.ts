// src/lib/api/client.ts
// Purpose: Configured Axios instance with auth token injection,
//          offline detection, and typed error response normalization.

import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse } from '@/types/api';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15_000, // 15 seconds before aborting
});

// ─── Request Interceptor — Attach Bearer Token ────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Read token from localStorage (set by auth store after login)
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('smartkiosk_token')
        : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ─── Response Interceptor — Normalize Errors ──────────────────────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    // 1. Check for offline / network failure
    if (!navigator.onLine) {
      const offlineError: ApiErrorResponse = {
        success: false,
        message: 'You are offline. This action will be queued and synced when you reconnect.',
      };
      return Promise.reject(offlineError);
    }

    if (error instanceof AxiosError) {
      // 2. Server returned a structured ApiErrorResponse body
      if (error.response?.data) {
        const data = error.response.data as ApiErrorResponse;
        if (typeof data.message === 'string') {
          return Promise.reject(data);
        }
      }

      // 3. Network timeout or no response
      if (error.code === 'ECONNABORTED' || !error.response) {
        const timeoutError: ApiErrorResponse = {
          success: false,
          message: 'Request timed out. Please check your connection and try again.',
        };
        return Promise.reject(timeoutError);
      }

      // 4. Generic HTTP error fallback
      const fallbackError: ApiErrorResponse = {
        success: false,
        message: error.message ?? 'An unexpected server error occurred.',
      };
      return Promise.reject(fallbackError);
    }

    // 5. Unknown error type
    const unknownError: ApiErrorResponse = {
      success: false,
      message: 'An unknown error occurred. Please try again.',
    };
    return Promise.reject(unknownError);
  },
);

export default apiClient;
