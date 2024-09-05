import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import { afterEach, inject, vi } from "vitest";

export const config = inject("tokenGenerationReadModelConfig");
export const { cleanup } = setupTestContainersVitest();

afterEach(cleanup);

export const sleep = (ms: number, mockDate = new Date()): Promise<void> =>
  new Promise((resolve) => {
    vi.useRealTimers();
    setTimeout(resolve, ms);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

// export const eservices = readModelRepository.eservices;

export const sleep = (ms: number, mockDate = new Date()): Promise<void> =>
  new Promise((resolve) => {
    vi.useRealTimers();
    setTimeout(resolve, ms);
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
