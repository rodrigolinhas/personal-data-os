import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchApi } from './client';

export const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string().optional(),
  version: z.string().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>('/health', HealthResponseSchema);
}

export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth(),
    refetchInterval: 10000,
    retry: 2,
  });
}
