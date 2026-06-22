// src/lib/utils.ts
// Purpose: Shared utility helpers — class merging, currency/date formatting, typed error handling.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ApiErrorResponse } from '@/types/api';

// ─── Tailwind Class Merge ─────────────────────────────────────────────────────

/**
 * Merges Tailwind CSS class strings, deduplicating conflicting utilities.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Currency Formatting ──────────────────────────────────────────────────────

/**
 * Formats a number as a localized currency string.
 * Defaults to KES (Kenya Shilling) for the African market.
 */
export function formatCurrency(
  amount: number,
  currency = 'KES',
  locale = 'en-KE',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a number with thousand separators only (no currency symbol).
 */
export function formatNumber(amount: number, locale = 'en-KE'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Formats an ISO date string into a human-readable date.
 * e.g. "26 May 2026"
 */
export function formatDate(isoString: string, locale = 'en-KE'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoString));
}

/**
 * Formats an ISO date string into a datetime display string.
 * e.g. "26 May 2026, 14:30"
 */
export function formatDateTime(isoString: string, locale = 'en-KE'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString));
}

/**
 * Returns a relative time string from an ISO timestamp.
 * e.g. "3 minutes ago", "2 days ago"
 */
export function formatRelativeTime(isoString: string, locale = 'en'): string {
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffSeconds = Math.round((past - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const thresholds: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2592000, 'week'],
    [31536000, 'month'],
    [Infinity, 'year'],
  ];

  let divisor = 1;
  let unit: Intl.RelativeTimeFormatUnit = 'second';

  for (const [threshold, u] of thresholds) {
    if (Math.abs(diffSeconds) < threshold) {
      unit = u;
      break;
    }
    divisor = threshold;
  }

  return rtf.format(Math.round(diffSeconds / divisor), unit);
}

// ─── Typed Error Handling ─────────────────────────────────────────────────────

/**
 * Type guard: checks if a value is a structured ApiErrorResponse from the backend.
 */
export function isApiError(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'success' in error &&
    (error as ApiErrorResponse).success === false &&
    'message' in error
  );
}

/**
 * Extracts a human-readable error message from any thrown error.
 * Handles backend ApiErrorResponse, standard Error, and unknown throws.
 */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Extracts field-level validation errors from an ApiErrorResponse.
 * Returns an empty record if no field errors are present.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || !error.errors) {
    return {};
  }
  // Flatten first error message per field
  return Object.fromEntries(
    Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]),
  );
}

// ─── Misc Helpers ─────────────────────────────────────────────────────────────

/**
 * Generates a truncated display version of a UUID.
 * e.g. "a1b2c3d4-..." → "a1b2c3d4"
 */
export function truncateUuid(uuid: string): string {
  return uuid.split('-')[0].toUpperCase();
}

/**
 * Capitalizes the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Safely parses JSON without throwing — returns null on failure.
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 * Uses native crypto.randomUUID() where supported, with a fallback.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
