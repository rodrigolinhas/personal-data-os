import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function mockDeleteMutation() {
  vi.spyOn(sleepApi, 'useDeleteSleepMutation').mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof sleepApi.useDeleteSleepMutation>);
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
  mockDeleteMutation();

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
  it('renders Personal Data OS branding', () => {
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

  it('renders module navigation with Sleep as active', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sleep page layout
// ---------------------------------------------------------------------------

describe('App — Sleep page layout', () => {
  it('renders the Sleep page heading', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByRole('heading', { name: /^sleep$/i })).toBeInTheDocument();
  });

  it('renders the Add sleep action button', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByRole('button', { name: /add sleep/i })).toBeInTheDocument();
  });

  it('renders the History section heading', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByRole('heading', { name: /history/i })).toBeInTheDocument();
  });

  it('renders the Sleep Statistics section heading and cards', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByRole('heading', { name: /sleep statistics/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /last 30 days/i })).toBeInTheDocument();
  });

  it('integrates SleepStats, Add sleep action, and SleepHistory simultaneously', () => {
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });
    expect(screen.getByRole('heading', { name: /sleep statistics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add sleep/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /history/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Add Sleep dialog
// ---------------------------------------------------------------------------

describe('App — Add Sleep dialog', () => {
  it('opens the Add Sleep Record dialog when Add sleep is clicked', async () => {
    const user = userEvent.setup();
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });

    await user.click(screen.getByRole('button', { name: /add sleep/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /add sleep record/i })).toBeInTheDocument();
  });

  it('closes the dialog when the close button is clicked', async () => {
    const user = userEvent.setup();
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });

    const trigger = screen.getByRole('button', { name: /add sleep/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close dialog/i });
    expect(closeButton).toHaveFocus();

    await user.click(closeButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the dialog when the native Escape cancel event fires', async () => {
    const user = userEvent.setup();
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });

    await user.click(screen.getByRole('button', { name: /add sleep/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels Add Sleep from the form', async () => {
    const user = userEvent.setup();
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });

    await user.click(screen.getByRole('button', { name: /add sleep/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the sleep form inside the dialog', async () => {
    const user = userEvent.setup();
    renderApp({ status: 'ok', service: 'personal-data-os-api', version: '0.1.0' });

    await user.click(screen.getByRole('button', { name: /add sleep/i }));

    // Form controls should be visible inside the dialog
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bedtime/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log sleep/i })).toBeInTheDocument();
  });
});
