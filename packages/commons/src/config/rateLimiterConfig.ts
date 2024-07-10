import { z } from "zod";

export const RedisRateLimiterConfig = z
  .object({
    LIMITER_GROUP: z.string(),
    MAX_REQUESTS: z.number(),
    BURST_PERCENTAGE: z.number(),
    RATE_INTERVAL: z.number(),
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number().min(1001),
    TIMEOUT: z.number(),
  })
  .transform((c) => ({
    limiterGroup: c.LIMITER_GROUP,
    maxRequests: c.MAX_REQUESTS,
    burstPercentage: c.BURST_PERCENTAGE,
    rateInterval: c.RATE_INTERVAL,
    redisHost: c.REDIS_HOST,
    redisPort: c.REDIS_PORT,
    timeout: c.TIMEOUT,
  }));
export type RedisRateLimiterConfig = z.infer<typeof RedisRateLimiterConfig>;
