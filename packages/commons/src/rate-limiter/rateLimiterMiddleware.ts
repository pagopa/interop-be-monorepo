import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  TenantId,
  genericError,
  makeApiProblemBuilder,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { ExpressContext, fromAppContext } from "../context/context.js";
import { getUserInfoFromAuthData } from "../auth/authData.js";
import { RateLimiter } from "./rateLimiterModel.js";
import { rateLimiterHeadersFromStatus } from "./rateLimiterUtils.js";

const makeApiProblem = makeApiProblemBuilder({});

export function rateLimiterMiddleware(
  rateLimiter: RateLimiter
): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    const ctx = fromAppContext(req.ctx);

    const organizationId: TenantId | undefined = getUserInfoFromAuthData(
      ctx.authData
    ).organizationId;

    if (!organizationId) {
      const errorRes = makeApiProblem(
        genericError("Missing expected organizationId claim in token"),
        () => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
        ctx
      );

      return res.status(errorRes.status).send(errorRes);
    }

    const rateLimiterStatus = await rateLimiter.rateLimitByOrganization(
      organizationId,
      ctx.logger
    );

    const headers = rateLimiterHeadersFromStatus(rateLimiterStatus);
    res.set(headers);

    if (rateLimiterStatus.limitReached) {
      const errorRes = makeApiProblem(
        tooManyRequestsError(organizationId),
        () => constants.HTTP_STATUS_TOO_MANY_REQUESTS,
        ctx
      );

      return res.status(errorRes.status).send(errorRes);
    } else {
      return next();
    }
  };
}
