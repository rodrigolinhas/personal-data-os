import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CreateSleepInputSchema, useCreateSleepMutation } from '../../api/sleep';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateForm(values: FormValues): string | Record<string, string> | null {
  // Parse quality as number for validation
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

  // Cross-field validation: bedtime must not equal wake_time
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

const inputClass =
  'mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 ' +
  'placeholder-slate-600 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const inputErrorClass =
  'mt-1.5 w-full rounded-lg border border-rose-500/60 bg-slate-900 px-3 py-2 text-sm text-slate-100 ' +
  'placeholder-slate-600 transition focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SleepForm: React.FC = () => {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { date: '', bedtime: '', wake_time: '', quality: '', notes: '' },
  });

  const mutation = useCreateSleepMutation();

  // Reset success state when the user starts modifying the form again
  useEffect(() => {
    if (mutation.isSuccess) {
      const timer = setTimeout(() => mutation.reset(), 4000);
      return () => clearTimeout(timer);
    }
  }, [mutation]);

  const onSubmit = handleSubmit((values) => {
    const validationResult = validateForm(values);
    if (validationResult && typeof validationResult === 'object') {
      Object.entries(validationResult).forEach(([field, message]) => {
        setError(field as keyof FormValues, { message });
      });
      return;
    }

    const quality = Number(values.quality);

    mutation.mutate(
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
  });

  const isSubmitting = mutation.isPending;

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Add sleep record" className="space-y-4">
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
          className={errors.date ? inputErrorClass : inputClass}
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
            className={errors.bedtime ? inputErrorClass : inputClass}
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
            className={errors.wake_time ? inputErrorClass : inputClass}
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
          className={errors.quality ? inputErrorClass : inputClass}
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
          className={`resize-none ${errors.notes ? inputErrorClass : inputClass}`}
          {...register('notes')}
        />
        <FieldError id="sleep-notes-error" message={errors.notes?.message} />
      </div>

      {/* Generic server error */}
      {mutation.isError &&
        !(mutation.error instanceof ApiError && [400, 409].includes(mutation.error.status)) && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Something went wrong. Please try again.'}
              </span>
            </div>
          </div>
        )}

      {/* Success feedback */}
      {mutation.isSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Sleep record saved successfully.</span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        id="sleep-form-submit"
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Saving…
          </>
        ) : (
          'Log sleep'
        )}
      </button>
    </form>
  );
};

export default SleepForm;
