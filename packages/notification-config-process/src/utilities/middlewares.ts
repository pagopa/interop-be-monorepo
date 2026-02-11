import { constants } from "http2";
import { RequestHandler } from "express";
import {
  AppContext,
  fromAppContext,
  isFeatureFlagEnabled,
} from "pagopa-interop-commons";
import { featureFlagNotEnabled } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";

export function notificationConfigFeatureFlagMiddleware(): RequestHandler {
  return async (req, res, next) => {
    const ctx = fromAppContext((req as unknown as { ctx: AppContext }).ctx);

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
