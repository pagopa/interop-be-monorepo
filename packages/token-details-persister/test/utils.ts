import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";

export const { cleanup, fileManager } = await setupTestContainersVitest(
  undefined,
  inject("fileManagerConfig")
);

afterEach(cleanup);
