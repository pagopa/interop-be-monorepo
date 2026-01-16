import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { NotificationType } from "pagopa-interop-models";
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
      const notificationType = NotificationType.parse(
        req.params.notificationType
      );
      const selfcareId = req.query.selfcareId;

      const redirectPath = `${notificationTypeToUiSection[notificationType]}/${req.params.entityId}`;

      // Fallback: if no selfcareId, redirect to generic frontend URL
      if (!selfcareId) {
        return res.redirect(config.frontendBaseUrl);
      }

      const selfcareUrl = new URL("/token-exchange", config.frontendBaseUrl);
      selfcareUrl.searchParams.set("institutionId", selfcareId);
      selfcareUrl.searchParams.set("productId", config.selfcareProductName);
      selfcareUrl.searchParams.set("redirectUrl", redirectPath);

      return res.redirect(selfcareUrl.href);
    }
  );

  return emailDeeplinkRouter;
};

export default emailDeeplinkRouter;
