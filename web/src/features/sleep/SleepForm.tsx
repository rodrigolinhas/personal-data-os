import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import {
  CreateSleepInputSchema,
  SleepRecord,
  useCreateSleepMutation,
  useUpdateSleepMutation,
} from '../../api/sleep';
import { ApiError } from '../../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormValues = {
  date: string;
  bedtime: string;
  wake_time: string;
  quality: string; // input[type=number] returns a string
  notes: string;
};

export type SleepFormMode = { type: 'create' } | { type: 'edit'; record: SleepRecord };

export interface SleepFormProps {
  mode?: SleepFormMode;
  onEditCancel?: () => void;
  onEditSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a map of field → error message, or null when the form is valid. */
function validateForm(values: FormValues): Record<string, string> | null {
  const qualityNum = Number(values.quality);
  const payload = {
    date: values.date,
    bedtime: values.bedtime,
    wake_time: values.wake_time,
    quality: isNaN(qualityNum) ? undefined : qualityNum,
    notes: values.notes || undefined,
  };

  const result = CreateSleepInputSchema.safeParse(payload);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return fieldErrors;
  }

  // Cross-field: bedtime must differ from wake_time
  if (values.bedtime && values.wake_time && values.bedtime === values.wake_time) {
    return { wake_time: 'Wake time must differ from bedtime' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Label + Input helpers
// ---------------------------------------------------------------------------

interface FieldLabelProps {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}

const FieldLabel: React.FC<FieldLabelProps> = ({ htmlFor, children, hint }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-200">
    {children}
    {hint && <span className="ml-1.5 text-xs font-normal text-slate-500">{hint}</span>}
  </label>
);

interface FieldErrorProps {
  id: string;
  message?: string;
}

const FieldError: React.FC<FieldErrorProps> = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className="mt-1 text-xs text-rose-400">
      {message}
    </p>
  ) : null;

const BASE_INPUT =
  'mt-1.5 w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 ' +
  'placeholder-slate-600 transition focus:outline-none focus:ring-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const INPUT_NORMAL = `${BASE_INPUT} border-slate-700 focus:border-indigo-500 focus:ring-indigo-500`;
const INPUT_ERROR = `${BASE_INPUT} border-rose-500/60 focus:border-rose-400 focus:ring-rose-400`;

function inputCn(hasError: boolean): string {
  return hasError ? INPUT_ERROR : INPUT_NORMAL;
}

// ---------------------------------------------------------------------------
// Normalize time value for <input type="time">
// The API may return HH:MM:SS — browsers only need HH:MM.
// ---------------------------------------------------------------------------
function normalizeTime(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SleepForm: React.FC<SleepFormProps> = ({
  mode = { type: 'create' },
  onEditCancel,
  onEditSuccess,
}) => {
  const isEditMode = mode.type === 'edit';

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { date: '', bedtime: '', wake_time: '', quality: '', notes: '' },
  });

  const createMutation = useCreateSleepMutation();
  const updateMutation = useUpdateSleepMutation();

  // Use the active mutation based on current mode.
  const activeMutation = isEditMode ? updateMutation : createMutation;
  const { isSuccess, reset: resetMutation } = activeMutation;

  // Auto-clear the success banner after 4 s so the form feels clean.
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(resetMutation, 4000);
    return () => clearTimeout(timer);
  }, [isSuccess, resetMutation]);

  // When entering edit mode or switching to a different record, pre-fill the form.
  useEffect(() => {
    if (mode.type === 'edit') {
      const { record } = mode;
      reset({
        date: record.date,
        bedtime: normalizeTime(record.bedtime),
        wake_time: normalizeTime(record.wake_time),
        quality: String(record.quality),
        notes: record.notes ?? '',
      });
      // Clear any lingering errors from a prior session.
      clearErrors();
      // Also reset mutation state when switching records.
      updateMutation.reset();
    } else {
      // Returning to create mode — restore defaults and clear errors.
      reset({ date: '', bedtime: '', wake_time: '', quality: '', notes: '' });
      clearErrors();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.type, mode.type === 'edit' ? mode.record.id : null]);

  const handleCancel = () => {
    reset({ date: '', bedtime: '', wake_time: '', quality: '', notes: '' });
    clearErrors();
    updateMutation.reset();
    onEditCancel?.();
  };

  const onSubmit = handleSubmit((values) => {
    const validationResult = validateForm(values);
    if (validationResult && typeof validationResult === 'object') {
      Object.entries(validationResult).forEach(([field, message]) => {
        setError(field as keyof FormValues, { message });
      });
      return;
    }

    const quality = Number(values.quality);

    if (isEditMode && mode.type === 'edit') {
      const { record } = mode;
      updateMutation.mutate(
        {
          id: record.id,
          input: {
            date: values.date,
            bedtime: values.bedtime,
            wake_time: values.wake_time,
            quality,
            notes: values.notes || undefined,
          },
        },
        {
          onSuccess: () => {
            onEditSuccess?.();
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              if (err.status === 409) {
                setError('date', {
                  message: 'A sleep record already exists for that date.',
                });
                return;
              }
              if (err.status === 404) {
                // Record disappeared — the inline 404 banner will show.
                // Exit edit mode after history refreshes.
                onEditCancel?.();
                return;
              }
              if (err.status === 400 && err.details && err.details.length > 0) {
                for (const detail of err.details) {
                  setError(detail.field as keyof FormValues, { message: detail.issue });
                }
                return;
              }
            }
            // Generic server/network error — shown via mutation.error banner.
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          date: values.date,
          bedtime: values.bedtime,
          wake_time: values.wake_time,
          quality,
          notes: values.notes || undefined,
        },
        {
          onSuccess: () => {
            reset();
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              if (err.status === 409) {
                setError('date', {
                  message: 'A sleep record already exists for this date.',
                });
                return;
              }
              if (err.status === 400 && err.details && err.details.length > 0) {
                for (const detail of err.details) {
                  setError(detail.field as keyof FormValues, { message: detail.issue });
                }
                return;
              }
            }
            // Generic server error shown via mutation.error
          },
        }
      );
    }
  });

  const isSubmitting = activeMutation.isPending;

  // Determine which mutation's error state to display.
  const mutationError = activeMutation.error;
  const showGenericError =
    activeMutation.isError &&
    !(mutationError instanceof ApiError && [400, 409].includes(mutationError.status));

  // Show the 404 banner separately — the record no longer exists.
  const show404Error =
    isEditMode &&
    updateMutation.isError &&
    updateMutation.error instanceof ApiError &&
    updateMutation.error.status === 404;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={isEditMode ? 'Edit sleep record' : 'Add sleep record'}
      className="space-y-4"
    >
      {/* Edit mode indicator banner */}
      {isEditMode && mode.type === 'edit' && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300">
          <span>
            Editing record for <span className="font-mono font-semibold">{mode.record.date}</span>
          </span>
          <button
            type="button"
            onClick={handleCancel}
            className="ml-2 rounded p-0.5 hover:bg-indigo-500/20 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            aria-label="Cancel editing"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Date */}
      <div>
        <FieldLabel htmlFor="sleep-date" hint="Date you woke up">
          Date
        </FieldLabel>
        <input
          id="sleep-date"
          type="date"
          autoComplete="off"
          aria-required="true"
          aria-describedby={errors.date ? 'sleep-date-error' : undefined}
          aria-invalid={!!errors.date}
          disabled={isSubmitting}
          className={inputCn(!!errors.date)}
          {...register('date')}
        />
        <FieldError id="sleep-date-error" message={errors.date?.message} />
      </div>

      {/* Bedtime + Wake time side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="sleep-bedtime">Bedtime</FieldLabel>
          <input
            id="sleep-bedtime"
            type="time"
            autoComplete="off"
            aria-required="true"
            aria-describedby={errors.bedtime ? 'sleep-bedtime-error' : undefined}
            aria-invalid={!!errors.bedtime}
            disabled={isSubmitting}
            className={inputCn(!!errors.bedtime)}
            {...register('bedtime')}
          />
          <FieldError id="sleep-bedtime-error" message={errors.bedtime?.message} />
        </div>

        <div>
          <FieldLabel htmlFor="sleep-wake-time">Wake time</FieldLabel>
          <input
            id="sleep-wake-time"
            type="time"
            autoComplete="off"
            aria-required="true"
            aria-describedby={errors.wake_time ? 'sleep-wake-time-error' : undefined}
            aria-invalid={!!errors.wake_time}
            disabled={isSubmitting}
            className={inputCn(!!errors.wake_time)}
            {...register('wake_time')}
          />
          <FieldError id="sleep-wake-time-error" message={errors.wake_time?.message} />
        </div>
      </div>

      {/* Quality */}
      <div>
        <FieldLabel htmlFor="sleep-quality" hint="1 = terrible · 10 = optimal">
          Sleep quality
        </FieldLabel>
        <input
          id="sleep-quality"
          type="number"
          min={1}
          max={10}
          step={1}
          placeholder="8"
          aria-required="true"
          aria-describedby={errors.quality ? 'sleep-quality-error' : undefined}
          aria-invalid={!!errors.quality}
          disabled={isSubmitting}
          className={inputCn(!!errors.quality)}
          {...register('quality')}
        />
        <FieldError id="sleep-quality-error" message={errors.quality?.message} />
      </div>

      {/* Notes */}
      <div>
        <FieldLabel htmlFor="sleep-notes">
          Notes <span className="text-xs font-normal text-slate-500">(optional)</span>
        </FieldLabel>
        <textarea
          id="sleep-notes"
          rows={2}
          placeholder="Any observations about this sleep session…"
          aria-describedby={errors.notes ? 'sleep-notes-error' : undefined}
          aria-invalid={!!errors.notes}
          disabled={isSubmitting}
          className={`resize-none ${inputCn(!!errors.notes)}`}
          {...register('notes')}
        />
        <FieldError id="sleep-notes-error" message={errors.notes?.message} />
      </div>

      {/* 404 error — record no longer exists */}
      {show404Error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300"
        >
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>This sleep record no longer exists.</span>
          </div>
        </div>
      )}

      {/* Generic server error */}
      {showGenericError && !show404Error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {mutationError instanceof Error
                ? mutationError.message
                : 'Something went wrong. Please try again.'}
            </span>
          </div>
        </div>
      )}

      {/* Success feedback */}
      {activeMutation.isSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {isEditMode
                ? 'Sleep record updated successfully.'
                : 'Sleep record saved successfully.'}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className={isEditMode ? 'flex gap-2' : undefined}>
        {isEditMode && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        <button
          id="sleep-form-submit"
          type="submit"
          disabled={isSubmitting}
          className={`flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${isEditMode ? 'flex-1' : 'w-full'}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : isEditMode ? (
            'Save changes'
          ) : (
            'Log sleep'
          )}
        </button>
      </div>
    </form>
  );
};

export default SleepForm;
