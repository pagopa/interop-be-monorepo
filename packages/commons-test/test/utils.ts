import { inject, afterEach } from "vitest";
import {
  MemoryRateLimiterConfig,
  RedisRateLimiterConfig,
  eventRepository,
} from "pagopa-interop-commons";
import { catalogEventToBinaryData } from "pagopa-interop-models";
import { setupTestContainersVitest } from "../src/index.js";

export const { cleanup, fileManager, postgresDB } =
  await setupTestContainersVitest(
    undefined,
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
    undefined
  );

afterEach(cleanup);

export const repository = eventRepository(postgresDB, catalogEventToBinaryData);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const s3Bucket = inject("fileManagerConfig")!.s3Bucket;

export const redisRateLimiterConfig = RedisRateLimiterConfig.parse(process.env);

export const memoryRateLimiterConfig = MemoryRateLimiterConfig.parse(
  process.env
);
