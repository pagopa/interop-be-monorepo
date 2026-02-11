import { Router } from "express";
import {
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  authRole,
  validateAuthorization,
  createTypedRouter,
} from "pagopa-interop-commons";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { NotificationConfigService } from "../services/notificationConfigService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  apiUserRoleToUserRole,
  tenantNotificationConfigToApiTenantNotificationConfig,
  userNotificationConfigToApiUserNotificationConfig,
} from "../model/domain/apiConverter.js";
import {
  createTenantDefaultNotificationConfigErrorMapper,
  deleteTenantNotificationConfigErrorMapper,
  getTenantNotificationConfigErrorMapper,
  getUserNotificationConfigErrorMapper,
  removeUserNotificationConfigRoleErrorMapper,
  updateTenantNotificationConfigErrorMapper,
  updateUserNotificationConfigErrorMapper,
} from "../utilities/errorMappers.js";

const notificationConfigRouter = (
  notificationConfigService: NotificationConfigService
): Router => {
  const { ADMIN_ROLE, API_ROLE, INTERNAL_ROLE, SECURITY_ROLE } = authRole;

  const router = createTypedRouter(notificationConfigApi.processEndpoints, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  router
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
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);
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
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);
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
          await notificationConfigService.createTenantDefaultNotificationConfig(
            unsafeBrandId(req.body.tenantId),
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
          createTenantDefaultNotificationConfigErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/internal/ensureUserNotificationConfigExistsWithRoles",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
            unsafeBrandId(req.body.userId),
            unsafeBrandId(req.body.tenantId),
            req.body.userRoles.map(apiUserRoleToUserRole),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/tenantNotificationConfigs/tenantId/{tenantId}",
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
      "/internal/userNotificationConfigs/tenantId/{tenantId}/userId/{userId}/userRole/{userRole}",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.removeUserNotificationConfigRole(
            unsafeBrandId(req.params.userId),
            unsafeBrandId(req.params.tenantId),
            apiUserRoleToUserRole(req.params.userRole),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeUserNotificationConfigRoleErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return router.expressRouter;
};
export default notificationConfigRouter;
