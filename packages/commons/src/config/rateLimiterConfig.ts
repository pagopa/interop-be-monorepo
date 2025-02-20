import { z } from "zod";

export const MemoryRateLimiterConfig = z
  .object({
    RATE_LIMITER_MAX_REQUESTS: z.coerce.number(),
    RATE_LIMITER_BURST_PERCENTAGE: z.coerce.number(),
    RATE_LIMITER_RATE_INTERVAL_MILLIS: z.coerce.number(),
  })
  .transform((c) => ({
    rateLimiterMaxRequests: c.RATE_LIMITER_MAX_REQUESTS,
    rateLimiterBurstPercentage: c.RATE_LIMITER_BURST_PERCENTAGE,
    rateLimiterRateInterval: c.RATE_LIMITER_RATE_INTERVAL_MILLIS,
  }));
export type MemoryRateLimiterConfig = z.infer<typeof MemoryRateLimiterConfig>;

export const RedisRateLimiterConfig = MemoryRateLimiterConfig.and(
  z
    .object({
      RATE_LIMITER_REDIS_HOST: z.string(),
      RATE_LIMITER_REDIS_PORT: z.coerce.number().min(1001),
      RATE_LIMITER_TIMEOUT_MILLIS: z.coerce.number(),
    })
    .transform((c) => ({
      rateLimiterRedisHost: c.RATE_LIMITER_REDIS_HOST,
      rateLimiterRedisPort: c.RATE_LIMITER_REDIS_PORT,
      rateLimiterTimeout: c.RATE_LIMITER_TIMEOUT_MILLIS,
    }))
);
export type RedisRateLimiterConfig = z.infer<typeof RedisRateLimiterConfig>;
