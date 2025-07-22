import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  ExpressContext,
  fromAppContext,
  isUiAuthData,
} from "pagopa-interop-commons";
import { unauthorizedError } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";

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
