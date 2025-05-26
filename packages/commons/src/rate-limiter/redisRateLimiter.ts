/* eslint-disable functional/no-let */
import { ConnectionTimeoutError, createClient } from "redis";
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
const RECONNECT_INTERVAL_MS = 10000; // 10 seconds

export async function initRedisRateLimiter(config: {
  limiterGroup: string;
  maxRequests: number;
  rateInterval: number;
  burstPercentage: number;
  redisHost: string;
  redisPort: number;
  timeout: number;
}): Promise<RateLimiter> {
  let redisClient: ReturnType<typeof createClient> | null = null;
  let rateLimiter: BurstyRateLimiter | null = null;
  let redisConnected = false;
  let connecting = false;

  async function connectRedis(): Promise<void> {
    if (redisConnected || connecting) {
      return;
    }
    connecting = true;
    try {
      const client = createClient({
        socket: {
          host: config.redisHost,
          port: config.redisPort,
          connectTimeout: config.timeout,
        },
      }).on("error", (err) => {
        genericLogger.warn(`Redis Client Error: ${err}`);
        redisConnected = false;
        throw new Error(`Redis connection error: ${err}`);
      });

      await client.connect();

      const options: IRateLimiterRedisOptions = {
        storeClient: client,
        keyPrefix: config.limiterGroup,
        points: config.maxRequests,
        duration: config.rateInterval / 1000,
      };

      const burstOptions: IRateLimiterRedisOptions = {
        ...options,
        keyPrefix: `${burstKeyPrefix}${config.limiterGroup}`,
        points: config.maxRequests * config.burstPercentage,
        duration: (config.rateInterval / 1000) * config.burstPercentage,
      };

      rateLimiter = new BurstyRateLimiter(
        new RateLimiterRedis(options),
        new RateLimiterRedis(burstOptions)
      );
      // ^ The BurstyRateLimiter is a RateLimiter that allows traffic bursts that exceed the rate limit.
      // See: https://github.com/animir/node-rate-limiter-flexible/wiki/BurstyRateLimiter

      redisClient = client;
      redisConnected = true;
      genericLogger.info("Redis connection established for rate limiter");
    } catch (err) {
      genericLogger.warn(`Could not connect to Redis at startup: ${err}`);
      redisConnected = false;
    } finally {
      connecting = false;
    }
  }

  // Start connection attempts in background, but don't await
  void connectRedis();
  setInterval(() => {
    if (!redisConnected) {
      void connectRedis();
    }
  }, RECONNECT_INTERVAL_MS);

  async function rateLimitByOrganization(
    organizationId: TenantId,
    logger: Logger
  ): Promise<RateLimiterStatus> {
    if (!redisConnected || !rateLimiter) {
      logger.warn(
        `Redis unavailable: bypassing rate limit for organization ${organizationId}`
      );
      return {
        limitReached: false,
        maxRequests: config.maxRequests,
        remainingRequests: config.maxRequests,
        rateInterval: config.rateInterval,
      };
    }
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
    if (!redisConnected || !redisClient) {
      return config.maxRequests;
    }
    return redisClient
      .get(`${config.limiterGroup}:${organizationId}`)
      .then(Number)
      .catch(() => config.maxRequests);
  }

  async function getBurstCountByOrganization(
    organizationId: TenantId
  ): Promise<number> {
    if (!redisConnected || !redisClient) {
      return config.maxRequests;
    }
    return redisClient
      .get(`${burstKeyPrefix}${config.limiterGroup}:${organizationId}`)
      .then(Number)
      .catch(() => config.maxRequests);
  }

  return {
    rateLimitByOrganization,
    getCountByOrganization,
    getBurstCountByOrganization,
  };
}
