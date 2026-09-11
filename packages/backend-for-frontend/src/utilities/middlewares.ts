import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { constants } from "http2";
import {
  ExpressContext,
  fromAppContext,
  isUiAuthData,
} from "pagopa-interop-commons";
import { unauthorizedError } from "pagopa-interop-models";

import { makeApiProblem } from "../model/errors.js";

/**
 * Exposes the matched route on the context, to scope the user facing error copy.
 * `req.route` is populated only once the route matches, i.e. after this
 * middleware has run, so the value is resolved lazily when the context is read
 * inside the route handler.
 */
export function endpointContextMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return (req, _res, next) => {
    Object.defineProperty(req.ctx, "endpoint", {
      configurable: true,
      enumerable: true,
      get: () =>
        req.route ? `${req.method.toUpperCase()} ${req.route.path}` : undefined,
    });
    return next();
  };
}

export function uiAuthDataValidationMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    // We assume that:
    // - contextMiddleware already set basic ctx info such as correlationId
    // - authenticationMiddleware already set authData in ctx

    const ctx = fromAppContext(req.ctx);

    if (!isUiAuthData(ctx.authData)) {
      const errorRes = makeApiProblem(
        unauthorizedError(
          `Invalid role ${ctx.authData.systemRole} for this operation`
        ),
        () => constants.HTTP_STATUS_FORBIDDEN,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }

    return next();
  };
}
