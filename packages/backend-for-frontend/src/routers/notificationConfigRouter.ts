import { ZodiosRouter } from "@zodios/express";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { bffApi } from "pagopa-interop-api-clients";
import { NotificationConfigService } from "../services/notificationConfigService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";

const notificationConfigRouter = (
  ctx: ZodiosContext,
  notificationConfigService: NotificationConfigService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const notificationConfigRouter = ctx.router(
    bffApi.notificationConfigsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  notificationConfigRouter
    .get("/tenantNotificationConfigs", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await notificationConfigService.getTenantNotificationConfig(ctx);
        return res
          .status(200)
          .send(bffApi.TenantNotificationConfig.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant notification config for tenant ${ctx.authData.organizationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenantNotificationConfigs", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await notificationConfigService.updateTenantNotificationConfig(
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating tenant notification config for tenant ${ctx.authData.organizationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/userNotificationConfigs", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await notificationConfigService.getUserNotificationConfig(ctx);
        return res
          .status(200)
          .send(bffApi.UserNotificationConfig.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving user notification config for user ${ctx.authData.userId} in tenant ${ctx.authData.organizationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/userNotificationConfigs", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await notificationConfigService.updateUserNotificationConfig(
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating user notification config for user ${ctx.authData.userId} in tenant ${ctx.authData.organizationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return notificationConfigRouter;
};

export default notificationConfigRouter;
