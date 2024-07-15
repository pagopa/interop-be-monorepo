import { inject, afterEach } from "vitest";
import { setupTestContainersVitest } from "../src/index.js";

export const { cleanup, fileManager, redisRateLimiter } =
  setupTestContainersVitest(
    undefined,
    undefined,
    inject("fileManagerConfig"),
    undefined,
    inject("redisRateLimiterConfig")
  );

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const s3Bucket = inject("fileManagerConfig")!.s3Bucket;
