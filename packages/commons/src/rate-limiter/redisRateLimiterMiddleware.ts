import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { ExpressContext } from "../context/context.js";
import { RedisRateLimiter } from "./redisRateLimiter.js";

export function redisRateLimiterMiddleware(
  redisRateLimiter: RedisRateLimiter
): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    try {
      await redisRateLimiter.rateLimitByOrganization(
        req.ctx.authData.organizationId,
        res
      );
      next();
    } catch {
      // TODO Set the right error and response headers
      // see https://github.com/animir/node-rate-limiter-flexible?tab=readme-ov-file#ratelimiterres-object
      res.status(429).send("Too Many Requests");
    }
  };
}
