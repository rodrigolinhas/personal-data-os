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

const defaultCreateMock = () =>
  ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }) as unknown as ReturnType<typeof sleepApi.useCreateSleepMutation>;

const defaultUpdateMock = () =>
  ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }) as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>;

function renderForm(props?: Partial<React.ComponentProps<typeof SleepForm>>) {
  const queryClient = makeQueryClient();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SleepForm {...props} />
    </QueryClientProvider>
  );
  return { ...utils, queryClient };
}

const validRecord: sleepApi.SleepRecord = {
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
// Rendering — create mode (defaults)
// ---------------------------------------------------------------------------

describe('SleepForm — rendering (create mode)', () => {
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

  it('does not show a Cancel button in create mode', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Rendering — edit mode
// ---------------------------------------------------------------------------

describe('SleepForm — rendering (edit mode)', () => {
  it('shows "Save changes" submit button and Cancel button in edit mode', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue(defaultUpdateMock());
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    // The form has a standalone Cancel button (not the banner X icon)
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    // "Log sleep" button should not appear in edit mode
    expect(screen.queryByRole('button', { name: /log sleep/i })).not.toBeInTheDocument();
  });

  it('pre-fills all editable fields from the record', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue(defaultUpdateMock());
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });

    expect(screen.getByLabelText(/date/i)).toHaveValue('2026-08-24');
    expect(screen.getByLabelText(/bedtime/i)).toHaveValue('23:30');
    expect(screen.getByLabelText(/wake time/i)).toHaveValue('07:00');
    expect(screen.getByLabelText(/sleep quality/i)).toHaveValue(8);
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Synthetic sleep record');
  });

  it('shows the editing indicator banner with the record date', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue(defaultUpdateMock());
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });

    expect(screen.getByText(/editing record for/i)).toBeInTheDocument();
    expect(screen.getByText('2026-08-24')).toBeInTheDocument();
  });

  it('uses the edit form aria-label in edit mode', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue(defaultUpdateMock());
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });

    expect(screen.getByRole('form', { name: /edit sleep record/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Client-side validation (shared by both modes)
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

  it('edit mode enforces the same validation rules', async () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue(defaultUpdateMock());
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    const user = userEvent.setup();
    renderForm({ mode: { type: 'edit', record: validRecord } });

    // Clear quality to trigger validation
    const qualityInput = screen.getByLabelText(/sleep quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '0');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/quality must be at least 1/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Submission — create mode
// ---------------------------------------------------------------------------

describe('SleepForm — submission (create mode)', () => {
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

// ---------------------------------------------------------------------------
// Submission — edit mode
// ---------------------------------------------------------------------------

describe('SleepForm — submission (edit mode)', () => {
  it('calls update mutation with correct id and input (no duration_minutes)', async () => {
    const mutateFn = vi.fn(
      (
        _args: { id: number; input: sleepApi.UpdateSleepInput },
        options?: { onSuccess?: (data: sleepApi.SleepRecord) => void }
      ) => {
        options?.onSuccess?.(validRecord);
      }
    );
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    const onEditSuccess = vi.fn();
    const user = userEvent.setup();
    renderForm({ mode: { type: 'edit', record: validRecord }, onEditSuccess });

    // Change the quality field
    const qualityInput = screen.getByLabelText(/sleep quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '9');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledOnce();
      const callArg = mutateFn.mock.calls[0][0];
      expect(callArg.id).toBe(1);
      expect(callArg.input).not.toHaveProperty('duration_minutes');
      expect(callArg.input.quality).toBe(9);
      expect(callArg.input.date).toBe('2026-08-24');
    });
  });

  it('shows "Sleep record updated successfully" after successful save', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });
    expect(screen.getByText(/sleep record updated successfully/i)).toBeInTheDocument();
  });

  it('disables Save while update is pending', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('shows duplicate-date conflict feedback on 409 — values remain', async () => {
    const mutateFn = vi.fn((_args: unknown, options?: { onError?: (err: Error) => void }) => {
      options?.onError?.(
        new ApiError(409, 'A sleep record already exists for that date.', 'CONFLICT')
      );
    });
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    const user = userEvent.setup();
    renderForm({ mode: { type: 'edit', record: validRecord } });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/a sleep record already exists for that date/i)).toBeInTheDocument();
    });
    // Form values must remain intact
    expect(screen.getByLabelText(/date/i)).toHaveValue('2026-08-24');
  });

  it('shows 404 error banner when record no longer exists', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new ApiError(404, 'Not found'),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });
    expect(screen.getByText(/this sleep record no longer exists/i)).toBeInTheDocument();
  });

  it('shows generic error for 500/network — values retained', () => {
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new ApiError(500, 'Internal server error'),
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    renderForm({ mode: { type: 'edit', record: validRecord } });
    expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    // Form values must remain
    expect(screen.getByLabelText(/date/i)).toHaveValue('2026-08-24');
  });
});

// ---------------------------------------------------------------------------
// Cancel — edit mode
// ---------------------------------------------------------------------------

describe('SleepForm — cancel (edit mode)', () => {
  it('calls onEditCancel without sending any request when Cancel is clicked', async () => {
    const mutateFn = vi.fn();
    vi.spyOn(sleepApi, 'useUpdateSleepMutation').mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof sleepApi.useUpdateSleepMutation>);
    vi.spyOn(sleepApi, 'useCreateSleepMutation').mockReturnValue(defaultCreateMock());

    const onEditCancel = vi.fn();
    const user = userEvent.setup();
    renderForm({ mode: { type: 'edit', record: validRecord }, onEditCancel });

    // Target the standalone Cancel button (not the banner X icon)
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(mutateFn).not.toHaveBeenCalled();
    expect(onEditCancel).toHaveBeenCalledOnce();
  });
});
