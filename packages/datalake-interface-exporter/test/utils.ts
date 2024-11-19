import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";

export const { cleanup, fileManager } = await setupTestContainersVitest(
  undefined,
  undefined,
  inject("fileManagerConfig")
);

afterEach(cleanup);
