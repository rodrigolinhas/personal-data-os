import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import * as healthApi from '../api/health';

describe('App Foundation Shell', () => {
  it('renders Personal Data OS branding and title', () => {
    vi.spyOn(healthApi, 'useHealthQuery').mockReturnValue({
      data: { status: 'ok', service: 'personal-data-os-api', version: '0.1.0' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof healthApi.useHealthQuery>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByText('Personal Data OS')).toBeInTheDocument();
    expect(screen.getByText('Engineering Foundation')).toBeInTheDocument();
  });

  it('displays System status: Online when health check responds ok', () => {
    vi.spyOn(healthApi, 'useHealthQuery').mockReturnValue({
      data: { status: 'ok', service: 'personal-data-os-api', version: '0.1.0' },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof healthApi.useHealthQuery>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByText(/System status: Online/i)).toBeInTheDocument();
    expect(screen.getByText(/personal-data-os-api \(0.1.0\)/i)).toBeInTheDocument();
  });

  it('displays System status: Offline when health check fails', () => {
    vi.spyOn(healthApi, 'useHealthQuery').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to connect to API'),
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof healthApi.useHealthQuery>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByText(/System status: Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to connect to API/i)).toBeInTheDocument();
  });
});
