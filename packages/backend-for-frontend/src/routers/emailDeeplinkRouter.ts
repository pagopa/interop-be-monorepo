import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  InteropTokenGenerator,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper, NotificationType } from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem, missingSelfcareId } from "../model/errors.js";
import { config } from "../config/config.js";
import { notificationTypeToUiSection } from "../model/modelMappingUtils.js";
import { TenantProcessClient } from "../clients/clientsProvider.js";

const emailDeeplinkRouter = (
  ctx: ZodiosContext,
  tenantProcessClient: TenantProcessClient,
  interopTokenGenerator: InteropTokenGenerator
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
      const tenantId = req.query.tenantId;

      try {
        const { serialized } =
          await interopTokenGenerator.generateInternalToken();

        const tenant = await tenantProcessClient.tenant.getTenant({
          params: { id: tenantId },
          headers: {
            ...ctx.headers,
            Authorization: `Bearer ${serialized}`,
          },
        });

        if (!tenant.selfcareId) {
          throw missingSelfcareId(tenantId);
        }

        const redirectPath = `${notificationTypeToUiSection[notificationType]}/${req.params.entityId}`;

        const selfcareUrl = new URL("/token-exchange", config.frontendBaseUrl);
        selfcareUrl.searchParams.set("institutionId", tenant.selfcareId);
        selfcareUrl.searchParams.set("productId", config.selfcareProductId);
        selfcareUrl.searchParams.set("redirectUrl", redirectPath);

        return res.redirect(selfcareUrl.href);
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
