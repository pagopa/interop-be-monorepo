import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  genericError,
  makeApiProblemBuilder,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { ExpressContext, fromAppContext } from "../context/context.js";
import { RateLimiter } from "./rateLimiterModel.js";
import { rateLimiterHeadersFromStatus } from "./rateLimiterUtils.js";

const makeApiProblem = makeApiProblemBuilder({});

export function rateLimiterMiddleware(
  rateLimiter: RateLimiter
): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    const ctx = fromAppContext(req.ctx);

    if (!ctx.authData?.organizationId) {
      const errorRes = makeApiProblem(
        genericError("Missing expected organizationId claim in token"),
        () => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
        ctx.logger
      );
      return res.status(errorRes.status).send(errorRes);
    }

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
        ctx.logger
      );

      return res.status(errorRes.status).send(errorRes);
    } else {
      return next();
    }
  };
}
