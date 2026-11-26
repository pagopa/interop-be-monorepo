/* eslint-disable functional/immutable-data */
import { vi } from "vitest";

import { logCapture } from "./logCapture.js";

const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

const capture = (
  output: (...data: unknown[]) => void,
  data: unknown[]
): void => {
  logCapture.entries.push(data.map(String).join(" "));
  output(...data);
};

vi.spyOn(console, "log").mockImplementation((...data: unknown[]) =>
  capture(originalLog, data)
);
vi.spyOn(console, "warn").mockImplementation((...data: unknown[]) =>
  capture(originalWarn, data)
);
vi.spyOn(console, "error").mockImplementation((...data: unknown[]) =>
  capture(originalError, data)
);
