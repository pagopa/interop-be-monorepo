import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";

export const { cleanup, fileManager } = await setupTestContainersVitest(
  undefined,
  inject("fileManagerConfig")
);

afterEach(cleanup);
