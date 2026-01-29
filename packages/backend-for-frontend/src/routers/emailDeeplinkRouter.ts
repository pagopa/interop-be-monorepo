import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper, NotificationType } from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";
import { config } from "../config/config.js";
import { notificationTypeToUiSection } from "../model/modelMappingUtils.js";

const emailDeeplinkRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const emailDeeplinkRouter = ctx.router(bffApi.emailDeepLinkApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  emailDeeplinkRouter.get(
    "/emailDeepLink/:notificationType/:entityId",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const notificationType = NotificationType.parse(
        req.params.notificationType
      );
      try {
        const url = new URL(
          `${notificationTypeToUiSection[notificationType]}/${req.params.entityId}`,
          config.frontendBaseUrl
        ).href;
        return res.redirect(url);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error generating email deepLink"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return emailDeeplinkRouter;
};

export default emailDeeplinkRouter;
