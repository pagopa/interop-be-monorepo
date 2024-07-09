import { Redis } from "ioredis";
import { TenantId } from "pagopa-interop-models";
import {
  IRateLimiterRedisOptions,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";
import { Response } from "express";

import { RedisRateLimiterConfig } from "../config/rateLimiterConfig.js";
import { genericLogger } from "../logging/index.js";

export type RedisRateLimiter = {
  rateLimitByOrganization: (
    organizationId: TenantId,
    res: Response
  ) => Promise<RateLimiterRes | void>;
};

export function initRedisRateLimiter(
  config: RedisRateLimiterConfig
): RedisRateLimiter {
  const redisClient = new Redis({
    enableOfflineQueue: false,
    host: config.redisHost,
    port: config.redisPort,
    commandTimeout: config.timeoutMillis,
  });

  // TODO if we need we can handle errors / reconnect as follows
  // redisClient.on('error', (err) => {
  // });

  const options: IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateIntervalSeconds,
    // TODO what is burst percentage and how to set it?
  };
  const rateLimiterRedis = new RateLimiterRedis(options);

  async function rateLimitByOrganization(
    organizationId: TenantId
    // res: Response
  ): Promise<RateLimiterRes | void> {
    try {
      return await rateLimiterRedis.consume(organizationId);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        // Max requests reached
        throw error;
      }
      if (error instanceof Error) {
        // Redis error.
        // In this case we want to do nothing and let the request pass
        genericLogger.info(
          `Redis error, making request pass - error: ${error}`
        );
        // TODO should we be more specific and catch only Redis timeout errors?
      }
    }
  }

  return {
    rateLimitByOrganization,
  };
}
