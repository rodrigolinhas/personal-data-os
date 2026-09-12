import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchApi } from './client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SleepRecordSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  bedtime: z.string(),
  wake_time: z.string(),
  duration_minutes: z.number().int().positive(),
  quality: z.number().int().min(1).max(10),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SleepListSchema = z.array(SleepRecordSchema);

// Fields the user submits — duration_minutes is NEVER included here.
export const CreateSleepInputSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  bedtime: z.string().min(1, 'Bedtime is required'),
  wake_time: z.string().min(1, 'Wake time is required'),
  quality: z
    .number({ invalid_type_error: 'Quality is required' })
    .int()
    .min(1, 'Quality must be at least 1')
    .max(10, 'Quality must be at most 10'),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SleepRecord = z.infer<typeof SleepRecordSchema>;
export type CreateSleepInput = z.infer<typeof CreateSleepInputSchema>;

export interface ListSleepParams {
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listSleep(params: ListSleepParams): Promise<SleepRecord[]> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  return fetchApi<SleepRecord[]>(`/api/v1/sleep?${query}`, SleepListSchema);
}

export async function createSleep(input: CreateSleepInput): Promise<SleepRecord> {
  // Explicitly build the payload to guarantee duration_minutes is never sent.
  const payload: Record<string, unknown> = {
    date: input.date,
    bedtime: input.bedtime,
    wake_time: input.wake_time,
    quality: input.quality,
  };
  if (input.notes && input.notes.trim() !== '') {
    payload.notes = input.notes.trim();
  }

  return fetchApi<SleepRecord>('/api/v1/sleep', SleepRecordSchema, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export const SLEEP_QUERY_KEY = 'sleep';

export function useSleepQuery(params: ListSleepParams) {
  return useQuery({
    queryKey: [SLEEP_QUERY_KEY, 'list', params],
    queryFn: () => listSleep(params),
    retry: 1,
  });
}

export function useCreateSleepMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSleep,
    onSuccess: () => {
      // Invalidate all sleep list queries so history refreshes automatically.
      void queryClient.invalidateQueries({ queryKey: [SLEEP_QUERY_KEY] });
    },
  });
}
