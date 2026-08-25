import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
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
    const errorText = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, `API request failed with status ${res.status}: ${errorText}`);
  }

  const data = await res.json();

  if (schema) {
    return schema.parse(data);
  }

  return data as T;
}
