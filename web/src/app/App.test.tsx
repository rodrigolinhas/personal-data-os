import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import * as healthApi from '../api/health';
import * as sleepApi from '../api/sleep';

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function mockSleepQuery(data: sleepApi.SleepRecord[] = []) {
  vi.spyOn(sleepApi, 'useSleepQuery').mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof sleepApi.useSleepQuery>);
}

const defaultStatsData: sleepApi.SleepStatsResponse = {
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

function mockSleepStatsQuery(data: sleepApi.SleepStatsResponse = defaultStatsData) {
  vi.spyOn(sleepApi, 'useSleepStatsQuery').mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof sleepApi.useSleepStatsQuery>);
}

function mockCreateMutation() {
  vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>);
}

function renderApp(healthData?: healthApi.HealthResponse, isError = false) {
  vi.spyOn(healthApi, 'useHealthQuery').mockReturnValue({
    data: healthData,
    isLoading: !healthData && !isError,
    isError,
    error: isError ? new Error('Failed to connect to API') : null,
    refetch: vi.fn(),
    isFetching: false,
  } as unknown as ReturnType<typeof healthApi.useHealthQuery>);

  mockSleepQuery();
  mockSleepStatsQuery();
  mockCreateMutation();

  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// App Foundation Shell
// ---------------------------------------------------------------------------

describe('App Foundation Shell', () => {
  it('renders Personal Data OS branding and title', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByText('Personal Data OS')).toBeInTheDocument();
  });

  it('displays API Online when health check responds ok', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByText(/api online/i)).toBeInTheDocument();
  });

  it('displays API Offline when health check fails', () => {
    renderApp(undefined, true);
    expect(screen.getByText(/api offline/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sleep Tracking workspace
// ---------------------------------------------------------------------------

describe('App — Sleep Tracking workspace', () => {
  it('renders the Sleep Tracking section heading', () => {
    renderApp({ status: 'ok' });
    expect(screen.getByRole('heading', { name: /sleep tracking/i })).toBeInTheDocument();
  });

  it('renders the Add Sleep Record form', () => {
    renderApp({ status: 'ok' });
    expect(screen.getByRole('button', { name: /log sleep/i })).toBeInTheDocument();
  });

  it('renders the Sleep History section heading', () => {
    renderApp({ status: 'ok' });
    expect(screen.getByRole('heading', { name: /sleep history/i })).toBeInTheDocument();
  });

  it('renders the Sleep Statistics section heading and cards', () => {
    renderApp({ status: 'ok' });
    expect(screen.getByRole('heading', { name: /sleep statistics/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /last 30 days/i })).toBeInTheDocument();
  });

  it('integrates SleepStats alongside SleepForm and SleepHistory simultaneously', () => {
    renderApp({ status: 'ok' });
    // Stats is rendered
    expect(screen.getByRole('heading', { name: /sleep statistics/i })).toBeInTheDocument();
    // Form is rendered
    expect(screen.getByRole('button', { name: /log sleep/i })).toBeInTheDocument();
    // History is rendered
    expect(screen.getByRole('heading', { name: /sleep history/i })).toBeInTheDocument();
  });
});
