import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "../src/index.js";

export const { cleanup, fileManager } = setupTestContainersVitest(
  undefined,
  undefined,
  inject("fileManagerConfig")
);

afterEach(cleanup);
