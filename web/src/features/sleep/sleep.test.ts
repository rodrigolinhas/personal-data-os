import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createSleep,
  deleteSleep,
  getSleepStats,
  listSleep,
  SleepRecordSchema,
  SleepListSchema,
  SleepStatsSummarySchema,
  SleepStatsResponseSchema,
  updateSleep,
  SLEEP_QUERY_KEY,
  useCreateSleepMutation,
  useUpdateSleepMutation,
  useDeleteSleepMutation,
} from '../../api/sleep';
import { formatAverageDuration, formatAverageQuality, formatRecordCount } from './formatDuration';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validRecord = {
  id: 1,
  date: '2026-08-24',
  bedtime: '23:30',
  wake_time: '07:00',
  duration_minutes: 450,
  quality: 8,
  notes: 'Synthetic sleep record',
  created_at: '2026-08-24T12:00:00Z',
  updated_at: '2026-08-24T12:00:00Z',
};

const validStatsWithData = {
  last_7_days: {
    average_duration_minutes: 450.5,
    average_quality: 8.2,
    record_count: 6,
  },
  last_30_days: {
    average_duration_minutes: 438.75,
    average_quality: 7.9,
    record_count: 22,
  },
};

const validStatsEmpty = {
  last_7_days: {
    average_duration_minutes: null,
    average_quality: null,
    record_count: 0,
  },
  last_30_days: {
    average_duration_minutes: null,
    average_quality: null,
    record_count: 0,
  },
};

// ---------------------------------------------------------------------------
// Zod schema tests
// ---------------------------------------------------------------------------

describe('SleepRecordSchema', () => {
  it('accepts a valid API response', () => {
    expect(() => SleepRecordSchema.parse(validRecord)).not.toThrow();
  });

  it('accepts null notes', () => {
    const result = SleepRecordSchema.parse({ ...validRecord, notes: null });
    expect(result.notes).toBeNull();
  });

  it('rejects a response missing duration_minutes', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { duration_minutes: _dm, ...rest } = validRecord;
    expect(() => SleepRecordSchema.parse(rest)).toThrow();
  });

  it('rejects quality out of range', () => {
    expect(() => SleepRecordSchema.parse({ ...validRecord, quality: 0 })).toThrow();
    expect(() => SleepRecordSchema.parse({ ...validRecord, quality: 11 })).toThrow();
  });

  it('rejects non-positive duration_minutes', () => {
    expect(() => SleepRecordSchema.parse({ ...validRecord, duration_minutes: 0 })).toThrow();
  });
});

describe('SleepListSchema', () => {
  it('accepts an empty array', () => {
    expect(() => SleepListSchema.parse([])).not.toThrow();
  });

  it('accepts an array of valid records', () => {
    expect(() => SleepListSchema.parse([validRecord, { ...validRecord, id: 2 }])).not.toThrow();
  });

  it('rejects invalid nested records', () => {
    expect(() => SleepListSchema.parse([{ ...validRecord, quality: 99 }])).toThrow();
  });
});

describe('SleepStatsSummarySchema', () => {
  it('accepts numeric and fractional averages with valid record count', () => {
    const summary = {
      average_duration_minutes: 450.5,
      average_quality: 8.25,
      record_count: 6,
    };
    expect(() => SleepStatsSummarySchema.parse(summary)).not.toThrow();
    const parsed = SleepStatsSummarySchema.parse(summary);
    expect(parsed.average_duration_minutes).toBe(450.5);
    expect(parsed.average_quality).toBe(8.25);
    expect(parsed.record_count).toBe(6);
  });

  it('accepts integer averages', () => {
    const summary = {
      average_duration_minutes: 480,
      average_quality: 8,
      record_count: 10,
    };
    expect(() => SleepStatsSummarySchema.parse(summary)).not.toThrow();
  });

  it('accepts null averages and record_count = 0 (empty window)', () => {
    const summary = {
      average_duration_minutes: null,
      average_quality: null,
      record_count: 0,
    };
    expect(() => SleepStatsSummarySchema.parse(summary)).not.toThrow();
    const parsed = SleepStatsSummarySchema.parse(summary);
    expect(parsed.average_duration_minutes).toBeNull();
    expect(parsed.average_quality).toBeNull();
    expect(parsed.record_count).toBe(0);
  });

  it('rejects negative record_count', () => {
    const summary = {
      average_duration_minutes: 450,
      average_quality: 8,
      record_count: -1,
    };
    expect(() => SleepStatsSummarySchema.parse(summary)).toThrow();
  });

  it('rejects non-integer record_count', () => {
    const summary = {
      average_duration_minutes: 450,
      average_quality: 8,
      record_count: 3.5,
    };
    expect(() => SleepStatsSummarySchema.parse(summary)).toThrow();
  });

  it('rejects invalid field types for averages', () => {
    expect(() =>
      SleepStatsSummarySchema.parse({
        average_duration_minutes: '450',
        average_quality: 8,
        record_count: 1,
      })
    ).toThrow();
    expect(() =>
      SleepStatsSummarySchema.parse({
        average_duration_minutes: 450,
        average_quality: '8',
        record_count: 1,
      })
    ).toThrow();
  });
});

describe('SleepStatsResponseSchema', () => {
  it('accepts valid stats with data in both windows', () => {
    expect(() => SleepStatsResponseSchema.parse(validStatsWithData)).not.toThrow();
  });

  it('accepts valid stats with empty windows', () => {
    expect(() => SleepStatsResponseSchema.parse(validStatsEmpty)).not.toThrow();
  });

  it('requires last_7_days', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { last_7_days: _omit, ...rest } = validStatsWithData;
    expect(() => SleepStatsResponseSchema.parse(rest)).toThrow();
  });

  it('requires last_30_days', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { last_30_days: _omit, ...rest } = validStatsWithData;
    expect(() => SleepStatsResponseSchema.parse(rest)).toThrow();
  });

  it('validates both summaries and rejects if either is invalid', () => {
    expect(() =>
      SleepStatsResponseSchema.parse({
        ...validStatsWithData,
        last_7_days: {
          average_duration_minutes: 450,
          average_quality: 8,
          record_count: -5,
        },
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// listSleep — URL params
// ---------------------------------------------------------------------------

describe('listSleep', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls the correct URL with limit and offset', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await listSleep({ limit: 10, offset: 20 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=20');
    expect(calledUrl).toContain('/api/v1/sleep');
  });
});

// ---------------------------------------------------------------------------
// createSleep — payload
// ---------------------------------------------------------------------------

describe('createSleep', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends the correct POST payload and does NOT include duration_minutes', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validRecord,
    } as Response);

    await createSleep({
      date: '2026-08-24',
      bedtime: '23:30',
      wake_time: '07:00',
      quality: 8,
      notes: 'Synthetic sleep record',
    });

    const callArgs = mockFetch.mock.calls[0];
    const options = callArgs[1] as RequestInit;
    const body = JSON.parse(options.body as string) as Record<string, unknown>;

    expect(body.date).toBe('2026-08-24');
    expect(body.bedtime).toBe('23:30');
    expect(body.wake_time).toBe('07:00');
    expect(body.quality).toBe(8);
    expect(body.notes).toBe('Synthetic sleep record');

    // CRITICAL: duration_minutes must never be sent by the client
    expect(body).not.toHaveProperty('duration_minutes');
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('created_at');
    expect(body).not.toHaveProperty('updated_at');
  });

  it('omits notes when not provided', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...validRecord, notes: null }),
    } as Response);

    await createSleep({
      date: '2026-08-24',
      bedtime: '23:30',
      wake_time: '07:00',
      quality: 8,
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;

    expect(body).not.toHaveProperty('notes');
  });
});

// ---------------------------------------------------------------------------
// updateSleep — URL, method, payload
// ---------------------------------------------------------------------------

describe('updateSleep', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends PUT to the correct URL including the record ID', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validRecord,
    } as Response);

    await updateSleep(42, {
      date: '2026-08-24',
      bedtime: '23:30',
      wake_time: '07:00',
      quality: 8,
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/sleep/42');

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe('PUT');
  });

  it('sends correct editable fields and does NOT include duration_minutes', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validRecord,
    } as Response);

    await updateSleep(1, {
      date: '2026-08-24',
      bedtime: '23:30',
      wake_time: '07:00',
      quality: 8,
      notes: 'Synthetic sleep record',
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;

    expect(body.date).toBe('2026-08-24');
    expect(body.bedtime).toBe('23:30');
    expect(body.wake_time).toBe('07:00');
    expect(body.quality).toBe(8);
    expect(body.notes).toBe('Synthetic sleep record');

    // CRITICAL: duration_minutes must never be sent by the client
    expect(body).not.toHaveProperty('duration_minutes');
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('created_at');
    expect(body).not.toHaveProperty('updated_at');
  });

  it('validates the PUT response with SleepRecordSchema', async () => {
    const mockFetch = vi.mocked(fetch);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { duration_minutes: _dm, ...invalidRecord } = validRecord;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => invalidRecord,
    } as Response);

    await expect(
      updateSleep(1, { date: '2026-08-24', bedtime: '23:30', wake_time: '07:00', quality: 8 })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deleteSleep — URL, method, 204 handling
// ---------------------------------------------------------------------------

describe('deleteSleep', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends DELETE to the correct URL including the record ID', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response);

    await deleteSleep(7);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/sleep/7');

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe('DELETE');
  });

  it('handles 204 No Content without attempting to parse JSON', async () => {
    const mockFetch = vi.mocked(fetch);
    const jsonSpy = vi.fn().mockRejectedValue(new Error('No body'));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: jsonSpy,
    } as unknown as Response);

    // Must not throw even though json() would fail
    await expect(deleteSleep(1)).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getSleepStats — URL, method, Zod validation
// ---------------------------------------------------------------------------

describe('getSleepStats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls exactly /api/v1/sleep/stats with default GET behavior', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validStatsWithData,
    } as Response);

    const stats = await getSleepStats();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('/api/v1/sleep/stats');

    const options = mockFetch.mock.calls[0][1] as RequestInit | undefined;
    expect(options?.method).toBeUndefined(); // default GET
    expect(stats).toEqual(validStatsWithData);
  });

  it('preserves fractional averages when returned by the API', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validStatsWithData,
    } as Response);

    const stats = await getSleepStats();

    expect(stats.last_7_days.average_duration_minutes).toBe(450.5);
    expect(stats.last_7_days.average_quality).toBe(8.2);
    expect(stats.last_30_days.average_duration_minutes).toBe(438.75);
    expect(stats.last_30_days.average_quality).toBe(7.9);
  });

  it('preserves null averages when windows have no records', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validStatsEmpty,
    } as Response);

    const stats = await getSleepStats();

    expect(stats.last_7_days.average_duration_minutes).toBeNull();
    expect(stats.last_7_days.average_quality).toBeNull();
    expect(stats.last_7_days.record_count).toBe(0);
    expect(stats.last_30_days.average_duration_minutes).toBeNull();
    expect(stats.last_30_days.average_quality).toBeNull();
    expect(stats.last_30_days.record_count).toBe(0);
  });

  it('rejects responses that violate SleepStatsResponseSchema', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        last_7_days: {
          average_duration_minutes: 'invalid_number',
          average_quality: 8,
          record_count: 5,
        },
        last_30_days: validStatsWithData.last_30_days,
      }),
    } as Response);

    await expect(getSleepStats()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Formatting utilities — presentation rounding rules
// ---------------------------------------------------------------------------

describe('formatAverageDuration', () => {
  it('returns "—" when duration is null (no data)', () => {
    expect(formatAverageDuration(null)).toBe('—');
  });

  it('rounds fractional average minutes to nearest whole minute', () => {
    expect(formatAverageDuration(450.5)).toBe('7h 31m');
    expect(formatAverageDuration(450.4)).toBe('7h 30m');
    expect(formatAverageDuration(438.75)).toBe('7h 19m');
  });

  it('formats whole hours cleanly', () => {
    expect(formatAverageDuration(480)).toBe('8h');
    expect(formatAverageDuration(60)).toBe('1h');
  });

  it('formats minutes only cleanly', () => {
    expect(formatAverageDuration(45)).toBe('45m');
    expect(formatAverageDuration(45.2)).toBe('45m');
  });
});

describe('formatAverageQuality', () => {
  it('returns "—" when quality is null (no data)', () => {
    expect(formatAverageQuality(null)).toBe('—');
  });

  it('formats integer and .0 averages without trailing ".0"', () => {
    expect(formatAverageQuality(8)).toBe('8 / 10');
    expect(formatAverageQuality(8.0)).toBe('8 / 10');
    expect(formatAverageQuality(10)).toBe('10 / 10');
  });

  it('rounds to at most one decimal place', () => {
    expect(formatAverageQuality(8.2)).toBe('8.2 / 10');
    expect(formatAverageQuality(8.24)).toBe('8.2 / 10');
    expect(formatAverageQuality(8.26)).toBe('8.3 / 10');
    expect(formatAverageQuality(7.95)).toBe('8 / 10');
  });
});

describe('formatRecordCount', () => {
  it('handles plural for 0 and multiple records', () => {
    expect(formatRecordCount(0)).toBe('0 nights');
    expect(formatRecordCount(2)).toBe('2 nights');
    expect(formatRecordCount(6)).toBe('6 nights');
    expect(formatRecordCount(22)).toBe('22 nights');
  });

  it('handles singular for 1 record', () => {
    expect(formatRecordCount(1)).toBe('1 night');
  });
});

// ---------------------------------------------------------------------------
// Mutation invalidation tests
// ---------------------------------------------------------------------------

describe('Sleep mutation invalidation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  const createWrapper = (queryClient: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('successful createSleep invalidates both stats and list queries via prefix key', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => validRecord,
    } as Response);

    const queryClient = new QueryClient();
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'stats'], validStatsWithData);
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }], [validRecord]);

    expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(false);
    expect(
      queryClient.getQueryState([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }])?.isInvalidated
    ).toBe(false);

    const { result } = renderHook(() => useCreateSleepMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      date: '2026-08-25',
      bedtime: '23:00',
      wake_time: '07:00',
      quality: 9,
    });

    await waitFor(() => {
      expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryState([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }])
          ?.isInvalidated
      ).toBe(true);
    });
  });

  it('successful updateSleep invalidates both stats and list queries via prefix key', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => validRecord,
    } as Response);

    const queryClient = new QueryClient();
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'stats'], validStatsWithData);
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }], [validRecord]);

    expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useUpdateSleepMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      id: 1,
      input: {
        date: '2026-08-24',
        bedtime: '23:00',
        wake_time: '07:00',
        quality: 9,
      },
    });

    await waitFor(() => {
      expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryState([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }])
          ?.isInvalidated
      ).toBe(true);
    });
  });

  it('successful deleteSleep invalidates both stats and list queries via prefix key', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response);

    const queryClient = new QueryClient();
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'stats'], validStatsWithData);
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }], [validRecord]);

    expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useDeleteSleepMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryState([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }])
          ?.isInvalidated
      ).toBe(true);
    });
  });

  it('failed mutations do NOT invalidate stats or list queries', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ error: { code: 'CONFLICT', message: 'duplicate date' } }),
    } as Response);

    const queryClient = new QueryClient();
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'stats'], validStatsWithData);
    queryClient.setQueryData([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }], [validRecord]);

    const { result } = renderHook(() => useCreateSleepMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      date: '2026-08-24',
      bedtime: '23:00',
      wake_time: '07:00',
      quality: 8,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(queryClient.getQueryState([SLEEP_QUERY_KEY, 'stats'])?.isInvalidated).toBe(false);
    expect(
      queryClient.getQueryState([SLEEP_QUERY_KEY, 'list', { limit: 20, offset: 0 }])?.isInvalidated
    ).toBe(false);
  });
});
