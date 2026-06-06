import * as SecureStore from 'expo-secure-store';
import { useAccountStore } from '@/store/account';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });

    if (res.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      throw new Error('UNAUTHORIZED');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Account-level blocks — forced sign-out, not a retryable error
      if (res.status === 402 || res.status === 403) {
        let code: string | undefined;
        try { code = (JSON.parse(text) as { code?: string }).code; } catch {}
        if (code === 'SUBSCRIPTION_EXPIRED' || code === 'ACCOUNT_FROZEN') {
          await SecureStore.deleteItemAsync('auth_token');
          useAccountStore.getState().setBlockReason(code as 'SUBSCRIPTION_EXPIRED' | 'ACCOUNT_FROZEN');
          throw new Error(code);
        }
      }
      throw new Error(`HTTP_${res.status}:${text}`);
    }
    const text = await res.text().catch(() => '');
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`HTTP_PARSE:Invalid server response`);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/mobile/auth', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getJobs: () => request<Job[]>('/api/mobile/jobs'),

  getProfile: () => request<User>('/api/mobile/profile'),

  submitForm: (jobItemId: string, data: SubmissionEntry[]) =>
    request<{ id: string; result: string | null }>(`/api/mobile/items/${jobItemId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),

  updateSubmission: (jobItemId: string, data: SubmissionEntry[], deletedPhotoIds?: string[]) =>
    request<{ id: string; result: string | null }>(`/api/mobile/items/${jobItemId}/submit`, {
      method: 'PATCH',
      body: JSON.stringify({ data, ...(deletedPhotoIds?.length ? { deletedPhotoIds } : {}) }),
    }),

  uploadPhoto: async (jobItemId: string, localUri: string, fieldId?: string) => {
    const token = await getToken();
    const filename = localUri.split('/').pop() ?? 'photo.jpg';
    const formData = new FormData();
    formData.append('photo', { uri: localUri, name: filename, type: 'image/jpeg' } as unknown as Blob);
    if (fieldId) formData.append('fieldId', fieldId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/api/mobile/items/${jobItemId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: formData,
        signal: controller.signal,
      });

      if (res.status === 401) {
        await SecureStore.deleteItemAsync('auth_token');
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP_${res.status}:${text}`);
      }
      return res.json() as Promise<{ id: string; url: string }>;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  uploadWorkerSignature: (jobItemId: string, imageData: string) =>
    request<{ url: string }>(`/api/mobile/items/${jobItemId}/worker-signature`, {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    }),

  uploadClientSignature: (jobId: string, imageData: string) =>
    request<{ url: string }>(`/api/mobile/jobs/${jobId}/client-signature`, {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    }),
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  accountId: string;
  canEditSubmissions: boolean;
}

export interface SchemaItem {
  id: string;
  label: string;
  type: 'pass_fail' | 'text' | 'number' | 'dropdown' | 'date' | 'datetime' | 'photo';
  required: boolean;
  options?: {
    choices?: string[];
    photoRequiredOnFail?: boolean;
    min?: number;
    max?: number;
    maxPhotos?: number;
    maxLength?: number;
  };
}

export interface SubmissionEntry {
  itemId: string;
  label: string;
  type: string;
  value: string | number | null;
}

export interface SubmissionPhoto {
  id: string;
  url: string;
  filename: string;
  fieldId: string | null;
}

export interface Submission {
  id: string;
  result: string | null;
  createdAt: string;
  data: SubmissionEntry[];
  workerSignatureUrl: string | null;
  photos: SubmissionPhoto[];
}

export interface JobItem {
  id: string;
  tag: string | null;
  status: string;
  template: {
    id: string;
    name: string;
    requireWorkerSignature: boolean;
    resolvedSchema: SchemaItem[];
  };
  submission: Submission | null;
}

export interface Job {
  id: string;
  name: string;
  clientName: string | null;
  location: string | null;
  scheduledAt: string | null;
  notes: string | null;
  type: string;
  status: string;
  requireClientSignature: boolean;
  clientSignatureUrl: string | null;
  clientReviewedAt: string | null;
  items: JobItem[];
}
