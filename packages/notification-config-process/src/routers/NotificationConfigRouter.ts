import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  authRole,
  validateAuthorization,
} from "pagopa-interop-commons";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper } from "pagopa-interop-models";
import { NotificationConfigService } from "../services/notificationConfigService.js";
import { makeApiProblem } from "../model/domain/errors.js";

const notificationConfigRouter = (
  ctx: ZodiosContext,
  notificationConfigService: NotificationConfigService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { ADMIN_ROLE } = authRole;

  return ctx
    .router(notificationConfigApi.processApi.api, {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    })
    .post("/tenantNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);
        await notificationConfigService.updateTenantNotificationConfig(
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/userNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);
        await notificationConfigService.updateUserNotificationConfig(
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    });
};
export default notificationConfigRouter;
