import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import axiosInstance from "../config/axios";

// Keep HTTP fixtures at the network boundary while production uses Axios's browser adapter.
axiosInstance.defaults.adapter = "fetch";
axiosInstance.defaults.env = {
  ...axiosInstance.defaults.env,
  fetch: async (input, init) => {
    if (!(input instanceof Request)) return globalThis.fetch(input, init);
    return globalThis.fetch(input.url, {
      ...init,
      method: input.method,
      headers: input.headers,
      signal: input.signal,
      body: ["GET", "HEAD"].includes(input.method)
        ? undefined
        : await input.clone().text(),
    });
  },
};

// jsdom has no layout observer; Radix uses it to measure form controls.
beforeEach(() => {
  axiosInstance.defaults.baseURL = new URL(
    "/__local-dashboard/api",
    window.location.origin
  ).href;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
