import { z } from "zod";

export const RedisRateLimiterConfig = z
  .object({
    LIMITER_GROUP: z.string(),
    MAX_REQUESTS: z.number(),
    BURST_PERCENTAGE: z.number(),
    RATE_INTERVAL_SECONDS: z.number(),
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number().min(1001),
    TIMEOUT_MILLIS: z.number(),
  })
  .transform((c) => ({
    limiterGroup: c.LIMITER_GROUP,
    maxRequests: c.MAX_REQUESTS,
    burstPercentage: c.BURST_PERCENTAGE,
    rateIntervalSeconds: c.RATE_INTERVAL_SECONDS,
    redisHost: c.REDIS_HOST,
    redisPort: c.REDIS_PORT,
    timeoutMillis: c.TIMEOUT_MILLIS,
  }));
export type RedisRateLimiterConfig = z.infer<typeof RedisRateLimiterConfig>;
