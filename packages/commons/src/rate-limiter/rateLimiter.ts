import {
  ConnectionTimeoutError,
  createClient as createRedisClient,
} from "redis";
import { TenantId } from "pagopa-interop-models";
import {
  BurstyRateLimiter,
  IRateLimiterOptions,
  IRateLimiterRedisOptions,
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
} from "rate-limiter-flexible";

import { match, P } from "ts-pattern";
import { genericLogger, Logger } from "../logging/index.js";
import {
  RateLimiter,
  RedisRateLimiter,
  RateLimiterStatus,
} from "./rateLimiterModel.js";

const burstKeyPrefix = "BURST_";

type RateLimiterConfig = {
  limiterGroup: string;
  maxRequests: number;
  rateInterval: number;
  burstPercentage: number;
};

async function processRateLimitByOrganization(
  config: RateLimiterConfig,
  rateLimiter: BurstyRateLimiter,
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
        logger.warn(`Rate Limit triggered for organization ${organizationId}`);
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function initBurstyRateLimter(
  config: RateLimiterConfig,
  redisClient: ReturnType<typeof createRedisClient> | undefined
) {
  const options: IRateLimiterOptions | IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: config.limiterGroup,
    points: config.maxRequests,
    duration: config.rateInterval / 1000, // seconds
  };

  const burstOptions: IRateLimiterOptions | IRateLimiterRedisOptions = {
    storeClient: redisClient,
    keyPrefix: `${burstKeyPrefix}${config.limiterGroup}`,
    points: config.maxRequests * config.burstPercentage,
    duration: (config.rateInterval / 1000) * config.burstPercentage,
  };

  const RateLimiterClass = redisClient ? RateLimiterRedis : RateLimiterMemory;
  const rateLimiter = new BurstyRateLimiter(
    new RateLimiterClass(options),
    new RateLimiterClass(burstOptions)
  );
  // ^ The BurstyRateLimiter is a RateLimiter that allows traffic bursts that exceed the rate limit.
  // See: https://github.com/animir/node-rate-limiter-flexible/wiki/BurstyRateLimiter

  const rateLimitByOrganization = (
    organizationId: TenantId,
    logger: Logger
  ): Promise<RateLimiterStatus> =>
    processRateLimitByOrganization(config, rateLimiter, organizationId, logger);

  return {
    rateLimiter,
    rateLimitByOrganization,
  };
}

export async function initRedisRateLimiter(
  config: RateLimiterConfig & {
    redisHost: string;
    redisPort: number;
    timeout: number;
  }
): Promise<RedisRateLimiter> {
  const redisClient = await createRedisClient({
    socket: {
      host: config.redisHost,
      port: config.redisPort,
      connectTimeout: config.timeout,
    },
  })
    .on("error", (err) => genericLogger.warn(`Redis Client Error: ${err}`))
    .connect();

  const { rateLimitByOrganization } = initBurstyRateLimter(config, redisClient);

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

export async function initMemoryRateLimiter(
  config: RateLimiterConfig
): Promise<RateLimiter> {
  const { rateLimitByOrganization } = initBurstyRateLimter(config, undefined);

  return {
    rateLimitByOrganization,
  };
}
