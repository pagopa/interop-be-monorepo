// import { vi } from "vitest";
import "dotenv-flow/config";
import app from "../src/app.js";

export const api = app;

// eslint-disable-next-line @typescript-eslint/no-empty-function
const globalSetup =
  async (): Promise<() => Promise<void>> =>
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async (): Promise<void> => {};
export default globalSetup;
