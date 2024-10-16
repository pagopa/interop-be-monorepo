import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    inject("fileManagerConfig")
  );

afterEach(cleanup);
