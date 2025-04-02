import { constants } from "http2";
import { P, match } from "ts-pattern";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  TenantId,
  makeApiProblemBuilder,
  tooManyRequestsError,
  unauthorizedError,
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

    const organizationId: TenantId | null = match(ctx.authData)
      .with(
        { systemRole: P.union("m2m", undefined) },
        ({ organizationId }) => organizationId
      )
      .with({ systemRole: P.union("internal", "maintenance") }, () => null)
      .exhaustive();

    if (!organizationId) {
      const errorRes = makeApiProblem(
        unauthorizedError(
          `No organizationId found in authData -- cannot apply rate limiting`
        ),
        () => constants.HTTP_STATUS_UNAUTHORIZED,
        ctx.logger,
        ctx.correlationId
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
        ctx.logger,
        ctx.correlationId
      );

      return res.status(errorRes.status).send(errorRes);
    } else {
      return next();
    }
  };
}
