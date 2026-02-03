import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import {
  badRequestError,
  DigestNotificationType,
  emptyErrorMapper,
  NotificationType,
} from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";
import { config } from "../config/config.js";
import {
  digestNotificationTypeToUiSection,
  notificationTypeToUiSection,
} from "../model/modelMappingUtils.js";

const emailDeeplinkRouters = (
  ctx: ZodiosContext
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
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

  const digestEmailDeeplinkRouter = ctx.router(
    bffApi.digestEmailDeepLinkApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  digestEmailDeeplinkRouter.get(
    "/emailDeepLink/:digestNotificationType",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      // query param and not path param because it is optional
      const { entityId } = req.query;

      try {
        const parseResult = DigestNotificationType.safeParse(
          req.params.digestNotificationType
        );
        if (!parseResult.success) {
          throw badRequestError(
            `Invalid digest notification type: ${req.params.digestNotificationType}`
          );
        }
        const notificationType = parseResult.data;
        const path = entityId
          ? `${digestNotificationTypeToUiSection[notificationType]}/${entityId}`
          : digestNotificationTypeToUiSection[notificationType];
        const url = new URL(`${config.frontendBaseUrl}${path}`);
        return res.redirect(url.href);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error generating email deepLink for digest"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return [emailDeeplinkRouter, digestEmailDeeplinkRouter];
};

export default emailDeeplinkRouters;
