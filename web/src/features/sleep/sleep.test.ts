import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSleep,
  deleteSleep,
  listSleep,
  SleepRecordSchema,
  SleepListSchema,
  updateSleep,
} from '../../api/sleep';

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
