import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as sleepApi from '../../api/sleep';
import { SleepHistory } from './SleepHistory';
import { formatDuration } from './formatDuration';

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderHistory() {
  const queryClient = makeQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SleepHistory />
    </QueryClientProvider>
  );
  return { ...utils, queryClient };
}

const makeRecord = (overrides: Partial<sleepApi.SleepRecord> = {}): sleepApi.SleepRecord => ({
  id: 1,
  date: '2026-08-24',
  bedtime: '23:30',
  wake_time: '07:00',
  duration_minutes: 450,
  quality: 8,
  notes: 'Synthetic sleep record',
  created_at: '2026-08-24T12:00:00Z',
  updated_at: '2026-08-24T12:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(450)).toBe('7h 30m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(480)).toBe('8h');
    expect(formatDuration(60)).toBe('1h');
  });

  it('formats minutes only', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(30)).toBe('30m');
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('SleepHistory — loading state', () => {
  it('shows loading indicator while fetching', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.getByLabelText(/loading sleep history/i)).toBeInTheDocument();
    // Must NOT show empty state while loading
    expect(screen.queryByText(/no sleep records yet/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('SleepHistory — empty state', () => {
  it('shows empty state when API returns empty array', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.getByText(/no sleep records yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add your first sleep record/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe('SleepHistory — error state', () => {
  it('shows error message when query fails', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/could not load sleep history/i)).toBeInTheDocument();
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('has a retry button when query fails', async () => {
    const mockRefetch = vi.fn();
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: mockRefetch,
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    const user = userEvent.setup();
    renderHistory();

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Records table
// ---------------------------------------------------------------------------

describe('SleepHistory — records', () => {
  it('renders records with date, bedtime, wake time, duration, and quality', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: [makeRecord()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.getByText('2026-08-24')).toBeInTheDocument();
    expect(screen.getByText('23:30')).toBeInTheDocument();
    expect(screen.getByText('07:00')).toBeInTheDocument();
    // Duration from server-returned duration_minutes (450 → "7h 30m")
    expect(screen.getByText('7h 30m')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
  });

  it('renders notes text when present', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: [makeRecord({ notes: 'Synthetic sleep record' })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.getByText('Synthetic sleep record')).toBeInTheDocument();
  });

  it('renders em-dash for null notes', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: [makeRecord({ notes: null })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.getByLabelText(/no notes/i)).toBeInTheDocument();
  });

  it('renders multiple records in order as delivered by API', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: [makeRecord({ id: 2, date: '2026-08-25' }), makeRecord({ id: 1, date: '2026-08-24' })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    const dates = screen.getAllByText(/2026-08-2[45]/);
    expect(dates[0]).toHaveTextContent('2026-08-25');
    expect(dates[1]).toHaveTextContent('2026-08-24');
  });

  it('does NOT display id, created_at, or updated_at columns', () => {
    vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
      data: [makeRecord()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);

    renderHistory();
    expect(screen.queryByText(/created_at/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/updated_at/i)).not.toBeInTheDocument();
  });
});
