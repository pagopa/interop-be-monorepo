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

const BURST_KEY_PREFIX = "BURST_";

/**
 * Returns a Redis-based rate limiter.
 * The function attempts a non-blocking connection to Redis on startup.
 * If Redis is down, requests are allowed to pass (fail-open) and
 * the client retries in the background without blocking the service.
 */
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
    disableOfflineQueue: true, // Fail immediately if Redis is down (no offline queue)
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      connectTimeout: config.timeout,
      // Reconnect indefinitely using a simple linear back-off.
      // Retries start at 1s, increase by 1s each time, capped at 30s.
      reconnectStrategy: (retries: number) => Math.min(retries * 1_000, 30_000),
    },
  }).on("error", (err) =>
    genericLogger.warn(
      `Redis Client Error (host: ${config.redisHost}, port: ${
        config.redisPort
      }): ${String(err.errors)}. The client will keep retrying in background.`
    )
  );
  // Attempt first connection, but do NOT await: if Redis is down, log and retry in background.
  redisClient
    .connect()
    .then(() =>
      genericLogger.info(
        `Redis client connected successfully to host ${config.redisHost}:${config.redisPort}`
      )
    )
    .catch((err) =>
      genericLogger.warn(
        `Redis client connection failed (host: ${
          config.redisHost
        }, port: ${config.redisPort}): ${String(
          err
        )}. Service is operating in fail-open mode for rate limiting.`
      )
    );

  const redisLimiterOptions: IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateInterval / 1000,
  };

  const burstLimiterOptions: IRateLimiterRedisOptions = {
    ...redisLimiterOptions,
    keyPrefix: `${BURST_KEY_PREFIX}${config.limiterGroup}`,
    points: Math.floor(config.maxRequests * config.burstPercentage),
    duration: (config.rateInterval / 1000) * config.burstPercentage,
  };

  // BurstyRateLimiter allows short bursts above the steady rate limit
  const rateLimiter = new BurstyRateLimiter(
    new RateLimiterRedis(redisLimiterOptions),
    new RateLimiterRedis(burstLimiterOptions)
  );

  /**
   * Attempts to consume a point for the given organization.
   * Fails open (allows requests) and logs on Redis errors/timeouts.
   */
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
            `Rate limit triggered for organization ${organizationId}: maximum of ${config.maxRequests} requests in ${config.rateInterval}ms exceeded.`
          );
          return {
            limitReached: true,
            maxRequests: config.maxRequests,
            remainingRequests: rejRes.remainingPoints,
            rateInterval: config.rateInterval,
          };
        })
        .with(P.instanceOf(ConnectionTimeoutError), () => {
          logger.warn(
            `Redis command timed out for organization ${organizationId}, allowing request to proceed as fallback.`
          );
          return {
            limitReached: false,
            maxRequests: config.maxRequests,
            remainingRequests: config.maxRequests,
            rateInterval: config.rateInterval,
          };
        })
        .otherwise((err) => {
          logger.warn(
            `Unexpected error during rate limiting for organization ${organizationId}: ${err}`
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

  /**
   * Returns the consumed points for a given organization from Redis.
   * If Redis is unavailable, returns 0.
   */
  async function getCountByOrganization(
    organizationId: TenantId
  ): Promise<number> {
    try {
      const val = await redisClient.get(
        `${config.limiterGroup}:${organizationId}`
      );
      return Number(val ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Returns the consumed burst points for a given organization from Redis.
   * If Redis is unavailable, returns 0.
   */
  async function getBurstCountByOrganization(
    organizationId: TenantId
  ): Promise<number> {
    try {
      const val = await redisClient.get(
        `${BURST_KEY_PREFIX}${config.limiterGroup}:${organizationId}`
      );
      return Number(val ?? 0);
    } catch {
      return 0;
    }
  }

  return {
    rateLimitByOrganization,
    getCountByOrganization,
    getBurstCountByOrganization,
  };
}
