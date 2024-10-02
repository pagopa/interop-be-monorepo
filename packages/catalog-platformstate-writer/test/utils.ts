/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inject, vi } from "vitest";

export const config = inject("tokenGenerationReadModelConfig");

export const sleep = (ms: number, mockDate = new Date()): Promise<void> =>
  new Promise((resolve) => {
    vi.useRealTimers();
    setTimeout(resolve, ms);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
