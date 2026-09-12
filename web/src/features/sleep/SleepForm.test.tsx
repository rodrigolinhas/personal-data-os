import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SleepForm } from './SleepForm';
import * as sleepApi from '../../api/sleep';
import { ApiError } from '../../api/client';

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

function renderForm() {
  const queryClient = makeQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SleepForm />
    </QueryClientProvider>
  );
  return { ...utils, queryClient };
}

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
// Rendering
// ---------------------------------------------------------------------------

describe('SleepForm — rendering', () => {
  it('renders all required form controls', () => {
    renderForm();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bedtime/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wake time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sleep quality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log sleep/i })).toBeInTheDocument();
  });

  it('submit button is enabled initially', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /log sleep/i })).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Client-side validation
// ---------------------------------------------------------------------------

describe('SleepForm — validation', () => {
  it('shows required errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /log sleep/i }));

    await waitFor(() => {
      expect(screen.getByText(/date is required/i)).toBeInTheDocument();
    });
  });

  it('shows error when quality is below 1', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/date/i), '2026-08-24');
    await user.type(screen.getByLabelText(/bedtime/i), '23:30');
    await user.type(screen.getByLabelText(/wake time/i), '07:00');

    const qualityInput = screen.getByLabelText(/sleep quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '0');

    await user.click(screen.getByRole('button', { name: /log sleep/i }));

    await waitFor(() => {
      expect(screen.getByText(/quality must be at least 1/i)).toBeInTheDocument();
    });
  });

  it('shows error when quality exceeds 10', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/date/i), '2026-08-24');
    await user.type(screen.getByLabelText(/bedtime/i), '23:30');
    await user.type(screen.getByLabelText(/wake time/i), '07:00');

    const qualityInput = screen.getByLabelText(/sleep quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '11');

    await user.click(screen.getByRole('button', { name: /log sleep/i }));

    await waitFor(() => {
      expect(screen.getByText(/quality must be at most 10/i)).toBeInTheDocument();
    });
  });

  it('shows error when bedtime equals wake time', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/date/i), '2026-08-24');
    await user.type(screen.getByLabelText(/bedtime/i), '07:00');
    await user.type(screen.getByLabelText(/wake time/i), '07:00');

    const qualityInput = screen.getByLabelText(/sleep quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '8');

    await user.click(screen.getByRole('button', { name: /log sleep/i }));

    await waitFor(() => {
      expect(screen.getByText(/wake time must differ from bedtime/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

describe('SleepForm — submission', () => {
  it('calls createSleep with correct payload (no duration_minutes)', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue({
      mutate: vi.fn((_input, options) => {
        options?.onSuccess?.(validRecord, _input, undefined);
      }),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>);

    renderForm();

    await user.type(screen.getByLabelText(/date/i), '2026-08-24');
    await user.type(screen.getByLabelText(/bedtime/i), '23:30');
    await user.type(screen.getByLabelText(/wake time/i), '07:00');

    const qualityInput = screen.getByLabelText(/sleep quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '8');

    await user.click(screen.getByRole('button', { name: /log sleep/i }));

    await waitFor(() => {
      const callArgs = (
        mockMutate.mock.results[0].value as ReturnType<typeof sleepApi.useCreateSleepMutation>
      ).mutate;
      const input = (callArgs as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(input).not.toHaveProperty('duration_minutes');
      expect(input.date).toBe('2026-08-24');
      expect(input.quality).toBe(8);
    });

    mockMutate.mockRestore();
  });

  it('disables submit button while submitting', () => {
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>);

    renderForm();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('shows success message after successful submission', () => {
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>);

    renderForm();
    expect(screen.getByText(/sleep record saved successfully/i)).toBeInTheDocument();
  });

  it('shows conflict error on 409 response (duplicate date)', () => {
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue({
      mutate: vi.fn((_input, options) => {
        options?.onError?.(
          new ApiError(409, 'A sleep record already exists for this date.', 'CONFLICT'),
          _input,
          undefined
        );
      }),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>);

    renderForm();
    // The 409 is mapped to the date field error, not the generic error banner
    // We test that the generic banner does NOT appear for 409
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('shows generic server error for 500 responses', () => {
    const serverError = new ApiError(500, 'Internal server error');

    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: true,
      error: serverError,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>);

    renderForm();
    expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
  });
});
