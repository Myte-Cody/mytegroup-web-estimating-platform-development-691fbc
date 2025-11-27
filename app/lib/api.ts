import { apiUrl } from '../config/domain';

export class ApiError extends Error {
  status?: number;
  data?: any;
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || apiUrl || 'http://localhost:3001').replace(/\/$/, '');

type RequestInitWithBody = RequestInit & { body?: BodyInit | null };

export async function apiFetch<T = any>(path: string, options: RequestInitWithBody = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed with status ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

export const labelForLegalType: Record<string, string> = {
  privacy_policy: 'Privacy Policy',
  terms: 'Terms & Conditions',
};
