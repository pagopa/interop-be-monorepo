import { constants } from "http2";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  ExpressContext,
  fromAppContext,
  isFeatureFlagEnabled,
} from "pagopa-interop-commons";
import { featureFlagNotEnabled } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/errors.js";

export function notificationConfigFeatureFlagMiddleware(): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    const ctx = fromAppContext(req.ctx);

    if (!isFeatureFlagEnabled(config, "featureFlagNotificationConfig")) {
      const errorRes = makeApiProblem(
        featureFlagNotEnabled("featureFlagNotificationConfig"),
        () => constants.HTTP_STATUS_FORBIDDEN,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }

    return next();
  };
}
