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
import {
  tenantNotificationConfigToApiTenantNotificationConfig,
  userNotificationConfigToApiUserNotificationConfig,
} from "../model/domain/apiConverter.js";
import {
  getTenantNotificationConfigErrorMapper,
  getUserNotificationConfigErrorMapper,
} from "../utilities/errorMappers.js";

const notificationConfigRouter = (
  ctx: ZodiosContext,
  notificationConfigService: NotificationConfigService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { ADMIN_ROLE, API_ROLE } = authRole;

  return ctx
    .router(notificationConfigApi.processApi.api, {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    })
    .get("/tenantNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);
        const tenantNotificationConfig =
          await notificationConfigService.getTenantNotificationConfig(ctx);
        return res
          .status(200)
          .send(
            notificationConfigApi.TenantNotificationConfig.parse(
              tenantNotificationConfigToApiTenantNotificationConfig(
                tenantNotificationConfig
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getTenantNotificationConfigErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/userNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);
        const userNotificationConfig =
          await notificationConfigService.getUserNotificationConfig(ctx);
        return res
          .status(200)
          .send(
            notificationConfigApi.UserNotificationConfig.parse(
              userNotificationConfigToApiUserNotificationConfig(
                userNotificationConfig
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getUserNotificationConfigErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenantNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);
        const tenantNotificationConfig =
          await notificationConfigService.updateTenantNotificationConfig(
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(
            notificationConfigApi.TenantNotificationConfig.parse(
              tenantNotificationConfigToApiTenantNotificationConfig(
                tenantNotificationConfig
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/userNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);
        const userNotificationConfig =
          await notificationConfigService.updateUserNotificationConfig(
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(
            notificationConfigApi.UserNotificationConfig.parse(
              userNotificationConfigToApiUserNotificationConfig(
                userNotificationConfig
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    });
};
export default notificationConfigRouter;
