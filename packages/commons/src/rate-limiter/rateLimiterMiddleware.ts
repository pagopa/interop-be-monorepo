import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  makeApiProblemBuilder,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { ExpressContext, fromAppContext } from "../context/context.js";
import { validateAuthorization } from "../auth/authorization.js";
import { RateLimiter } from "./rateLimiterModel.js";
import { rateLimiterHeadersFromStatus } from "./rateLimiterUtils.js";

const makeApiProblem = makeApiProblemBuilder({});

export function rateLimiterMiddleware(
  rateLimiter: RateLimiter
): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    const ctx = fromAppContext(req.ctx);
    validateAuthorization(
      ctx,
      ["ui", "m2m"],
      ["admin", "api", "support", "security"]
    );

    const rateLimiterStatus = await rateLimiter.rateLimitByOrganization(
      ctx.authData.organizationId,
      ctx.logger
    );

    const headers = rateLimiterHeadersFromStatus(rateLimiterStatus);
    res.set(headers);

    if (rateLimiterStatus.limitReached) {
      const errorRes = makeApiProblem(
        tooManyRequestsError(ctx.authData.organizationId),
        () => constants.HTTP_STATUS_TOO_MANY_REQUESTS,
        ctx.logger,
        ctx.correlationId
      );

      return res.status(errorRes.status).send(errorRes);
    } else {
      return next();
    }
  };
}
