import { z } from 'zod';

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export class ApiError extends Error {
  public code?: string;
  public details?: ApiErrorDetail[];

  constructor(
    public status: number,
    message: string,
    code?: string,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export async function fetchApi<T>(
  endpoint: string,
  schema?: z.ZodSchema<T>,
  options?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const rawText = await res.text().catch(() => res.statusText);
    try {
      const body = JSON.parse(rawText) as {
        error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
      };
      if (body.error) {
        throw new ApiError(
          res.status,
          body.error.message ?? rawText,
          body.error.code,
          body.error.details
        );
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    throw new ApiError(res.status, rawText);
  }

  // 204 No Content has no body — skip JSON parsing entirely.
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (schema) {
    return schema.parse(data);
  }

  return data as T;
}
