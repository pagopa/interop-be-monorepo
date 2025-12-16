import { inject, afterEach } from "vitest";
import { eventRepository } from "pagopa-interop-commons";
import { catalogEventToBinaryData } from "pagopa-interop-models";
import { setupTestContainersVitest } from "../src/index.js";

export const { cleanup, fileManager, postgresDB, redisRateLimiter } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
    undefined,
    inject("redisRateLimiterConfig")
  );

afterEach(cleanup);

export const repository = eventRepository(postgresDB, catalogEventToBinaryData);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const s3Bucket = inject("fileManagerConfig")!.s3Bucket;
