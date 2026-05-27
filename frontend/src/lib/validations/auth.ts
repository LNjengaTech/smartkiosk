// src/lib/validations/auth.ts
// Purpose: Zod schemas for authentication form validation.

import { z } from 'zod';

// ─── Login Schema ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .min(8, 'Password must be at least 8 characters.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Register Schema ──────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    // Owner personal info
    name: z
      .string()
      .min(1, 'Full name is required.')
      .min(2, 'Name must be at least 2 characters.'),
    email: z
      .string()
      .min(1, 'Email address is required.')
      .email('Please enter a valid email address.'),
    phone: z
      .string()
      .min(1, 'Phone number is required.')
      .regex(/^\+?[0-9]{9,15}$/, 'Enter a valid phone number (e.g. +254712345678).'),
    password: z
      .string()
      .min(1, 'Password is required.')
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
    password_confirmation: z
      .string()
      .min(1, 'Please confirm your password.'),

    // Business info
    business_name: z
      .string()
      .min(1, 'Business name is required.')
      .min(2, 'Business name must be at least 2 characters.'),
    location: z.string().optional(),
    business_phone: z.string().optional(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password_confirmation'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
