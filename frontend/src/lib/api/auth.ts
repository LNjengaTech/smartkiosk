// src/lib/api/auth.ts
// Purpose: Auth API service functions wrapping the backend authentication endpoints.

import apiClient from './client';
import type {
  ApiResponse,
  LoginPayload,
  LoginResponse,
  MeResponse,
} from '@/types/api';

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await apiClient.post<ApiResponse<LoginResponse>>(
    '/auth/login',
    payload,
  );
  return response.data.data;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

// ─── Me (Authenticated Profile) ───────────────────────────────────────────────

export async function getMe(): Promise<MeResponse> {
  const response = await apiClient.get<ApiResponse<MeResponse>>('/auth/me');
  return response.data.data;
}
