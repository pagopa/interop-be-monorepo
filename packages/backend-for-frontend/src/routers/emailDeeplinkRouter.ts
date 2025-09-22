import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper } from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";
import { calculateDeepLink } from "../api/inAppNotificationApiConverter.js";
import { config } from "../config/config.js";

const emailDeeplinkRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const emailDeeplinkRouter = ctx.router(bffApi.emailDeeplinkApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  emailDeeplinkRouter.get(
    "/emailDeeplink/:notificationType/:entityId",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const deepLink = calculateDeepLink(
          req.params.notificationType,
          req.params.entityId
        );
        const url = `${config.frontendBaseUrl}${deepLink}`;
        return res.redirect(url);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error generating email deeplink"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return emailDeeplinkRouter;
};

export default emailDeeplinkRouter;
