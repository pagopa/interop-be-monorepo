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

/**
 * Builds the token-exchange URL for selfcare authentication.
 * Returns null if selfcareId is not provided.
 */
function buildTokenExchangeUrl(
  selfcareId: string | undefined,
  redirectPath: string
): string | null {
  if (!selfcareId) {
    return null;
  }

  const selfcareUrl = new URL("/token-exchange", config.frontendBaseUrl);
  selfcareUrl.searchParams.set("institutionId", selfcareId);
  selfcareUrl.searchParams.set("productId", config.selfcareProductName);
  selfcareUrl.searchParams.set("redirectUrl", redirectPath);

  return selfcareUrl.href;
}

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
      const redirectPath = `${notificationTypeToUiSection[notificationType]}/${req.params.entityId}`;
      const redirectUrl = buildTokenExchangeUrl(
        req.query.selfcareId,
        redirectPath
      );

      return res.redirect(redirectUrl ?? config.frontendBaseUrl);
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
      const { entityId, selfcareId } = req.query;

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
        const section = digestNotificationTypeToUiSection[notificationType];
        const redirectPath = entityId ? `${section}/${entityId}` : section;
        const redirectUrl = buildTokenExchangeUrl(selfcareId, redirectPath);

        return res.redirect(redirectUrl ?? config.frontendBaseUrl);
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
