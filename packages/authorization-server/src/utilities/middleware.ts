import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  ExpressContext,
  fromAppContext,
  isFeatureFlagEnabled,
} from "pagopa-interop-commons";
import { featureFlagNotEnabled } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";

export function asyncExchangeFeatureFlagMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    const ctx = fromAppContext(req.ctx);

    if (!isFeatureFlagEnabled(config, "featureFlagAsyncExchange")) {
      const errorRes = makeApiProblem(
        featureFlagNotEnabled("featureFlagAsyncExchange"),
        () => constants.HTTP_STATUS_NOT_IMPLEMENTED,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }

    return next();
  };
}
