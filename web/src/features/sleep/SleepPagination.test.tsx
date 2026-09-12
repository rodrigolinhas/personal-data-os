import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SleepPagination } from './SleepPagination';

function renderPagination(props: Partial<React.ComponentProps<typeof SleepPagination>> = {}) {
  const defaults = {
    offset: 0,
    limit: 20,
    returnedCount: 20,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    isLoading: false,
  };
  return render(<SleepPagination {...defaults} {...props} />);
}

describe('SleepPagination', () => {
  it('hides pagination when there is nothing to paginate (first page, fewer than limit)', () => {
    const { container } = renderPagination({ offset: 0, returnedCount: 5, limit: 20 });
    expect(container.firstChild).toBeNull();
  });

  it('Previous is disabled on the first page (offset = 0)', () => {
    renderPagination({ offset: 0, returnedCount: 20 });
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('Next is enabled when returned count equals limit (full page)', () => {
    renderPagination({ offset: 0, returnedCount: 20, limit: 20 });
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('Next is disabled when returned count is less than limit', () => {
    renderPagination({ offset: 0, returnedCount: 5, limit: 20 });
    // When both are disabled, component returns null (tested above).
    // With Previous disabled and Next disabled by count < limit, it renders nothing.
    // This scenario is covered by the hide test above.
    // Test with offset > 0 so Previous is enabled and nav renders.
    renderPagination({ offset: 20, returnedCount: 5, limit: 20 });
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('Previous is enabled when offset > 0', () => {
    renderPagination({ offset: 20, returnedCount: 20 });
    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
  });

  it('clicking Next calls onNext', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderPagination({ offset: 0, returnedCount: 20, onNext });

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('clicking Previous calls onPrevious', async () => {
    const onPrevious = vi.fn();
    const user = userEvent.setup();
    renderPagination({ offset: 20, returnedCount: 20, onPrevious });

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('both buttons are disabled while loading', () => {
    renderPagination({ offset: 20, returnedCount: 20, isLoading: true });
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});
