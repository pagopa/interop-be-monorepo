import { Redis } from "ioredis";
import { TenantId } from "pagopa-interop-models";
import {
  IRateLimiterRedisOptions,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";

import { match, P } from "ts-pattern";
import { RedisRateLimiterConfig } from "../config/redisRateLimiterConfig.js";
import { Logger } from "../logging/index.js";
import { RateLimiter, RateLimiterStatus } from "./rateLimiterModel.js";

export function initRedisRateLimiter(
  config: RedisRateLimiterConfig
): RateLimiter {
  const redisClient = new Redis({
    enableOfflineQueue: false,
    host: config.redisHost,
    port: config.redisPort,
    commandTimeout: config.timeout,
    // ^ If a command does not return a reply within a set number of milliseconds,
    // a "Command timed out" error will be thrown.
  });
  // TODO Should we set reconnectOnError to reconnect on specific errors?

  const options: IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateInterval / 1000, // seconds
  };
  // TODO do we need to allow traffict bursts and use the BURST_PERCENTAGE config?
  // Seems to be supported but we need to set a burst points limit
  // and also a burst rate interval.
  // In Scala I see burstRequests = config.maxRequests * config.burstPercentage
  // but what about the burst interval? Shoul we config.rateIntervalSeconds * config.burstPercentage?
  // See: https://github.com/animir/node-rate-limiter-flexible/wiki/BurstyRateLimiter
  const rateLimiterRedis = new RateLimiterRedis(options);

  async function rateLimitByOrganization(
    organizationId: TenantId,
    logger: Logger
  ): Promise<RateLimiterStatus> {
    try {
      const rateLimiterRes = await rateLimiterRedis.consume(organizationId);
      return {
        limitReached: false,
        maxRequests: config.maxRequests,
        rateInterval: config.rateInterval,
        remainingRequests: rateLimiterRes.remainingPoints,
        msBeforeNext: rateLimiterRes.msBeforeNext,
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
            rateInterval: config.rateInterval,
            remainingRequests: rejRes.remainingPoints,
            msBeforeNext: rejRes.msBeforeNext,
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
            rateInterval: config.rateInterval,
          };
        });
    }
  }

  return {
    rateLimitByOrganization,
  };
}
