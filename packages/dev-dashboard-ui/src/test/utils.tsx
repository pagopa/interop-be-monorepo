import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type ProviderOptions = { client?: QueryClient; initialEntries?: string[] };

export function createTestWrapper({
  client = createTestQueryClient(),
  initialEntries,
}: ProviderOptions = {}) {
  return function TestProviders({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries ?? ["/"]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  {
    client = createTestQueryClient(),
    initialEntries,
    ...options
  }: Omit<RenderOptions, "wrapper"> & ProviderOptions = {}
) {
  return {
    ...render(ui, {
      ...options,
      wrapper: createTestWrapper({ client, initialEntries }),
    }),
    client,
  };
}
