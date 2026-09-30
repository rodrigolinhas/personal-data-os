import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as sleepApi from '../../api/sleep';
import { SleepStats } from './SleepStats';

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

function renderStats() {
  const queryClient = makeQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SleepStats />
    </QueryClientProvider>
  );
  return { ...utils, queryClient };
}

const mockStatsWithData: sleepApi.SleepStatsResponse = {
  last_7_days: {
    average_duration_minutes: 450.5,
    average_quality: 8.24,
    record_count: 6,
  },
  last_30_days: {
    average_duration_minutes: 438.75,
    average_quality: 7.95,
    record_count: 22,
  },
};

const mockStatsEmpty: sleepApi.SleepStatsResponse = {
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

const mockStatsPartiallyEmpty: sleepApi.SleepStatsResponse = {
  last_7_days: {
    average_duration_minutes: null,
    average_quality: null,
    record_count: 0,
  },
  last_30_days: {
    average_duration_minutes: 480,
    average_quality: 8.0,
    record_count: 14,
  },
};

// ---------------------------------------------------------------------------
// 1. Loading state
// ---------------------------------------------------------------------------

describe('SleepStats — loading state', () => {
  it('shows loading indicator and text with aria-busy="true"', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    expect(screen.getByText(/loading sleep statistics…/i)).toBeInTheDocument();
    const busyContainer = screen.getByLabelText(/loading sleep statistics/i);
    expect(busyContainer).toHaveAttribute('aria-busy', 'true');
    // Heading must still be present
    expect(screen.getByRole('heading', { name: /sleep statistics/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Success with data
// ---------------------------------------------------------------------------

describe('SleepStats — success with data', () => {
  it('renders both 7-day and 30-day cards with duration, quality, and record counts', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: mockStatsWithData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    expect(screen.getByRole('heading', { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /last 30 days/i })).toBeInTheDocument();

    const sevenDayCard = screen.getByLabelText(/last 7 days statistics/i);
    expect(sevenDayCard).toHaveTextContent('7h 31m');
    expect(sevenDayCard).toHaveTextContent('8.2 / 10');
    expect(sevenDayCard).toHaveTextContent('6 nights');

    const thirtyDayCard = screen.getByLabelText(/last 30 days statistics/i);
    expect(thirtyDayCard).toHaveTextContent('7h 19m');
    expect(thirtyDayCard).toHaveTextContent('8 / 10');
    expect(thirtyDayCard).toHaveTextContent('22 nights');
  });
});

// ---------------------------------------------------------------------------
// 3. Fractional duration rounding
// ---------------------------------------------------------------------------

describe('SleepStats — fractional duration formatting', () => {
  it('rounds fractional average minutes to nearest whole minute', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: {
        last_7_days: {
          average_duration_minutes: 450.5, // 451m -> 7h 31m
          average_quality: 8,
          record_count: 5,
        },
        last_30_days: {
          average_duration_minutes: 450.4, // 450m -> 7h 30m
          average_quality: 8,
          record_count: 10,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    const sevenDayCard = screen.getByLabelText(/last 7 days statistics/i);
    expect(sevenDayCard).toHaveTextContent('7h 31m');

    const thirtyDayCard = screen.getByLabelText(/last 30 days statistics/i);
    expect(thirtyDayCard).toHaveTextContent('7h 30m');
  });
});

// ---------------------------------------------------------------------------
// 4. Fractional quality rounding
// ---------------------------------------------------------------------------

describe('SleepStats — fractional quality formatting', () => {
  it('rounds average quality to one decimal place and strips trailing ".0"', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: {
        last_7_days: {
          average_duration_minutes: 480,
          average_quality: 8.26, // -> 8.3
          record_count: 5,
        },
        last_30_days: {
          average_duration_minutes: 480,
          average_quality: 8.0, // -> 8
          record_count: 10,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    const sevenDayCard = screen.getByLabelText(/last 7 days statistics/i);
    expect(sevenDayCard).toHaveTextContent('8.3 / 10');

    const thirtyDayCard = screen.getByLabelText(/last 30 days statistics/i);
    expect(thirtyDayCard).toHaveTextContent('8 / 10');
  });
});

// ---------------------------------------------------------------------------
// 5. Empty both windows
// ---------------------------------------------------------------------------

describe('SleepStats — empty both windows', () => {
  it('renders explicit no-data representation without misleading zero averages', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: mockStatsEmpty,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    const sevenDayCard = screen.getByLabelText(/last 7 days statistics/i);
    const thirtyDayCard = screen.getByLabelText(/last 30 days statistics/i);

    // Must show '—' for averages, not '0h' or '0 / 10'
    expect(sevenDayCard).not.toHaveTextContent('0h');
    expect(sevenDayCard).not.toHaveTextContent('0 / 10');
    expect(sevenDayCard).toHaveTextContent('—');
    expect(sevenDayCard).toHaveTextContent('0 nights');
    expect(sevenDayCard).toHaveTextContent('No sleep data in this period.');

    expect(thirtyDayCard).not.toHaveTextContent('0h');
    expect(thirtyDayCard).not.toHaveTextContent('0 / 10');
    expect(thirtyDayCard).toHaveTextContent('—');
    expect(thirtyDayCard).toHaveTextContent('0 nights');
    expect(thirtyDayCard).toHaveTextContent('No sleep data in this period.');
  });
});

// ---------------------------------------------------------------------------
// 6. Partially empty (7-day empty, 30-day populated)
// ---------------------------------------------------------------------------

describe('SleepStats — partially empty', () => {
  it('shows empty state only on the 7-day card while 30-day card shows real data', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: mockStatsPartiallyEmpty,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    const sevenDayCard = screen.getByLabelText(/last 7 days statistics/i);
    const thirtyDayCard = screen.getByLabelText(/last 30 days statistics/i);

    // 7-day card is empty
    expect(sevenDayCard).toHaveTextContent('No sleep data in this period.');
    expect(sevenDayCard).toHaveTextContent('0 nights');

    // 30-day card has real data and no empty message
    expect(thirtyDayCard).not.toHaveTextContent('No sleep data in this period.');
    expect(thirtyDayCard).toHaveTextContent('8h');
    expect(thirtyDayCard).toHaveTextContent('8 / 10');
    expect(thirtyDayCard).toHaveTextContent('14 nights');
  });
});

// ---------------------------------------------------------------------------
// 7. Error state
// ---------------------------------------------------------------------------

describe('SleepStats — error state', () => {
  it('renders localized error alert and Retry button', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Could not load sleep statistics');
    expect(alert).toHaveTextContent('Network timeout');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. Retry behavior
// ---------------------------------------------------------------------------

describe('SleepStats — retry behavior', () => {
  it('triggers stats refetch when Retry button is clicked', async () => {
    const user = userEvent.setup();
    const mockRefetch = vi.fn();

    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
      isFetching: false,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Background refresh
// ---------------------------------------------------------------------------

describe('SleepStats — background refresh', () => {
  it('preserves existing data on screen and displays Refreshing indicator when isFetching is true', () => {
    vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
      data: mockStatsWithData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);

    renderStats();

    // Data remains visible
    const sevenDayCard = screen.getByLabelText(/last 7 days statistics/i);
    expect(sevenDayCard).toHaveTextContent('7h 31m');
    expect(sevenDayCard).toHaveTextContent('8.2 / 10');

    // Subtle refreshing indicator is shown
    expect(screen.getByLabelText(/refreshing sleep statistics/i)).toBeInTheDocument();
    expect(screen.getByText(/refreshing…/i)).toBeInTheDocument();
  });
});
