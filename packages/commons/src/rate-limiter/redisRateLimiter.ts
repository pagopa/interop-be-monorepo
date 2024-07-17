import {
  ConnectionTimeoutError,
  createClient as createRedisClient,
} from "redis";
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

const burstKeyPrefix = "BURST_";

export async function initRedisRateLimiter(config: {
  limiterGroup: string;
  maxRequests: number;
  rateInterval: number;
  burstPercentage: number;
  redisHost: string;
  redisPort: number;
  timeout: number;
}): Promise<RateLimiter> {
  const redisClient = await createRedisClient({
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      connectTimeout: config.timeout,
    },
    disableOfflineQueue: true,
  })
    .on("error", (err) => genericLogger.warn(`Redis Client Error: ${err}`))
    .connect();

  const options: IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateInterval / 1000, // seconds
  };

  const burstOptions: IRateLimiterRedisOptions = {
    ...options,
    keyPrefix: `${burstKeyPrefix}${config.limiterGroup}`,
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
        .with(P.intersection(P.instanceOf(ConnectionTimeoutError)), () => {
          logger.warn(
            `Redis command timed out, making request pass for organization ${organizationId}`
          );
          return {
            limitReached: false,
            maxRequests: config.maxRequests,
            remainingRequests: config.maxRequests,
            rateInterval: config.rateInterval,
          };
        })
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
    getCountByOrganization: async (
      organizationId: TenantId
    ): Promise<string | null> =>
      redisClient.get(`${config.limiterGroup}:${organizationId}`),
    getBurstCountByOrganization: async (
      organizationId: TenantId
    ): Promise<string | null> =>
      redisClient.get(
        `${burstKeyPrefix}${config.limiterGroup}:${organizationId}`
      ),
  };
}
