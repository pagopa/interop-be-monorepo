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
import { unsafeBrandId } from "pagopa-interop-models";
import { NotificationConfigService } from "../services/notificationConfigService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  tenantNotificationConfigToApiTenantNotificationConfig,
  userNotificationConfigToApiUserNotificationConfig,
} from "../model/domain/apiConverter.js";
import {
  createTenantNotificationConfigErrorMapper,
  createUserNotificationConfigErrorMapper,
  deleteTenantNotificationConfigErrorMapper,
  deleteUserNotificationConfigErrorMapper,
  getTenantNotificationConfigErrorMapper,
  getUserNotificationConfigErrorMapper,
  updateTenantNotificationConfigErrorMapper,
  updateUserNotificationConfigErrorMapper,
} from "../utilities/errorMappers.js";

const notificationConfigRouter = (
  ctx: ZodiosContext,
  notificationConfigService: NotificationConfigService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { ADMIN_ROLE, API_ROLE, INTERNAL_ROLE } = authRole;

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
        const errorRes = makeApiProblem(
          error,
          updateTenantNotificationConfigErrorMapper,
          ctx
        );
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
        const errorRes = makeApiProblem(
          error,
          updateUserNotificationConfigErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/internal/tenantNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);
        const tenantNotificationConfig =
          await notificationConfigService.createTenantNotificationConfig(
            {
              tenantId: unsafeBrandId(req.body.tenantId),
              config: req.body.config,
            },
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
        const errorRes = makeApiProblem(
          error,
          createTenantNotificationConfigErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/internal/userNotificationConfigs", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);
        const userNotificationConfig =
          await notificationConfigService.createUserNotificationConfig(
            {
              userId: unsafeBrandId(req.body.userId),
              tenantId: unsafeBrandId(req.body.tenantId),
              inAppConfig: req.body.inAppConfig,
              emailConfig: req.body.emailConfig,
            },
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
        const errorRes = makeApiProblem(
          error,
          createUserNotificationConfigErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/internal/tenantNotificationConfigs/tenantId/:tenantId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.deleteTenantNotificationConfig(
            unsafeBrandId(req.params.tenantId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteTenantNotificationConfigErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/userNotificationConfigs/tenantId/:tenantId/userId/:userId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.deleteUserNotificationConfig(
            unsafeBrandId(req.params.userId),
            unsafeBrandId(req.params.tenantId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteUserNotificationConfigErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
};
export default notificationConfigRouter;
