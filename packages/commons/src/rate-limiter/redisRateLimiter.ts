import { Redis } from "ioredis";
import { TenantId } from "pagopa-interop-models";
import {
  BurstyRateLimiter,
  IRateLimiterRedisOptions,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";

import { match, P } from "ts-pattern";
import { genericLogger, Logger } from "../logging/index.js";
import { RateLimiter, RateLimiterStatus } from "./rateLimiterModel.js";

export function initRedisRateLimiter(config: {
  limiterGroup: string;
  maxRequests: number;
  rateInterval: number;
  burstPercentage: number;
  redisHost: string;
  redisPort: number;
  timeout: number;
}): RateLimiter {
  const redisClient = new Redis({
    enableOfflineQueue: false,
    host: config.redisHost,
    port: config.redisPort,
    commandTimeout: config.timeout,
    // ^ If a command does not return a reply within a set number of milliseconds,
    // a "Command timed out" error will be thrown.
    reconnectOnError: (error): boolean => {
      genericLogger.warn(`Reconnecting on Redis error: ${error}`);
      return true;
    },
  });

  const options: IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateInterval / 1000, // seconds
  };

  const burstOptions: IRateLimiterRedisOptions = {
    ...options,
    keyPrefix: `burst_${config.limiterGroup}`,
    points: config.maxRequests * config.burstPercentage,
    duration: (config.rateInterval / 1000) * config.burstPercentage,
  };

  const rateLimiter = new BurstyRateLimiter(
    new RateLimiterRedis(options),
    new RateLimiterRedis(burstOptions)
  );
  // ^ The BurstyRateLimiter is a RateLimiter that allows traffic bursts that exceed the rate limit.
  // See: https://github.com/animir/node-rate-limiter-flexible/wiki/BurstyRateLimiter

  async function rateLimitByOrganization(
    organizationId: TenantId,
    logger: Logger
  ): Promise<RateLimiterStatus> {
    try {
      const rateLimiterRes = await rateLimiter.consume(organizationId);
      return {
        limitReached: false,
        maxRequests: config.maxRequests,
        remainingRequests: rateLimiterRes.remainingPoints,
        rateInterval: config.rateInterval,
      };
    } catch (error) {
      return match(error)
        .with(P.instanceOf(RateLimiterRes), (rejRes) => {
          logger.warn(
            `Rate Limit triggered for organization ${organizationId}`
          );
          return {
            limitReached: true,
            maxRequests: config.maxRequests,
            remainingRequests: rejRes.remainingPoints,
            rateInterval: config.rateInterval,
          };
        })
        .with(
          P.intersection(P.instanceOf(Error), { message: "Command timed out" }),
          () => {
            logger.warn(
              `Redis command timed out, making request pass for organization ${organizationId}`
            );
            return {
              limitReached: false,
              maxRequests: config.maxRequests,
              remainingRequests: config.maxRequests,
              rateInterval: config.rateInterval,
            };
          }
        )
        .otherwise((error) => {
          logger.warn(
            `Unexpected error during rate limiting for organization ${organizationId} - ${error}`
          );
          return {
            limitReached: false,
            maxRequests: config.maxRequests,
            remainingRequests: config.maxRequests,
            rateInterval: config.rateInterval,
          };
        });
    }
  }

  return {
    rateLimitByOrganization,
  };
}
