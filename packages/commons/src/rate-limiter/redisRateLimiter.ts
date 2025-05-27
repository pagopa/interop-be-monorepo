import {
  ConnectionTimeoutError,
  createClient as createRedisClient,
} from "redis";
import { TenantId } from "pagopa-interop-models";
import {
  BurstyRateLimiter,
  IRateLimiterRedisOptions,
  RateLimiterMemory,
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
  const redisClient = createRedisClient({
    // legacyMode: true, // Use legacy mode for compatibility with rate-limiter-flexible
    disableOfflineQueue: true, // disable the offline queue to make requests fail immediately if Redis is down
    // so that the rate limiter fallbacks to the insurance limiter
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      connectTimeout: config.timeout,
      /**
       * Reconnect indefinitely using a simple exponential back‑off.
       * `retries` starts at 1 and increases by 1 for every failed attempt.
       * We cap the delay at 30.000 ms to avoid very long waits.
       */
      reconnectStrategy: (retries: number) => Math.min(retries * 1_000, 30_000),
    },
  }).on("error", (err) => genericLogger.warn(`Redis Client Error: ${err}`));

  // Kick‑off the first connection attempt, but do **not** await it.
  // If Redis is down at start‑up, the promise rejects, we log, and the
  // client keeps retrying in the background without crashing the service.
  redisClient
    .connect()
    .catch((err) =>
      genericLogger.warn(
        `Initial Redis connect failed, will keep retrying automatically: ${err}`
      )
    );

  const insuranceLimiter = new RateLimiterMemory({
    keyPrefix: `${config.limiterGroup}_MEM`,
    points: config.maxRequests, // stesso budget
    duration: config.rateInterval / 1000,
  });

  const options: IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateInterval / 1000, // seconds
    insuranceLimiter,
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

  async function getCountByOrganization(
    organizationId: TenantId
  ): Promise<number> {
    return redisClient
      .get(`${config.limiterGroup}:${organizationId}`)
      .then(Number);
  }

  async function getBurstCountByOrganization(
    organizationId: TenantId
  ): Promise<number> {
    return redisClient
      .get(`${burstKeyPrefix}${config.limiterGroup}:${organizationId}`)
      .then(Number);
  }

  return {
    rateLimitByOrganization,
    getCountByOrganization,
    getBurstCountByOrganization,
  };
}
