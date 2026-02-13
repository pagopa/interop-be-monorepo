import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  fromAppContext,
  authRole,
  validateAuthorization,
  sendApiProblemReply,
  registerRoutes,
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

const notificationConfigRouter =
  (notificationConfigService: NotificationConfigService): FastifyPluginAsync =>
  async (app: FastifyInstance) => {
    const { ADMIN_ROLE, API_ROLE, INTERNAL_ROLE, SECURITY_ROLE } = authRole;

    const handlers: Omit<
      notificationConfigApi.NotificationConfigRouteHandlers,
      "getStatus"
    > = {
      getTenantNotificationConfig: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);
          const tenantNotificationConfig =
            await notificationConfigService.getTenantNotificationConfig(ctx);
          return reply
            .status(200)
            .send(
              notificationConfigApi.zTenantNotificationConfig.parse(
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
          return sendApiProblemReply(reply, errorRes);
        }
      },

      updateTenantNotificationConfig: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);
          const tenantNotificationConfig =
            await notificationConfigService.updateTenantNotificationConfig(
              request.body,
              ctx
            );
          return reply
            .status(200)
            .send(
              notificationConfigApi.zTenantNotificationConfig.parse(
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
          return sendApiProblemReply(reply, errorRes);
        }
      },

      getUserNotificationConfig: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);
          const userNotificationConfig =
            await notificationConfigService.getUserNotificationConfig(ctx);
          return reply
            .status(200)
            .send(
              notificationConfigApi.zUserNotificationConfig.parse(
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
          return sendApiProblemReply(reply, errorRes);
        }
      },

      updateUserNotificationConfig: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);
          const userNotificationConfig =
            await notificationConfigService.updateUserNotificationConfig(
              request.body,
              ctx
            );
          return reply
            .status(200)
            .send(
              notificationConfigApi.zUserNotificationConfig.parse(
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
          return sendApiProblemReply(reply, errorRes);
        }
      },

      createTenantDefaultNotificationConfig: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          const tenantNotificationConfig =
            await notificationConfigService.createTenantDefaultNotificationConfig(
              unsafeBrandId(request.body.tenantId),
              ctx
            );
          return reply
            .status(200)
            .send(
              notificationConfigApi.zTenantNotificationConfig.parse(
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
          return sendApiProblemReply(reply, errorRes);
        }
      },

      ensureUserNotificationConfigExistsWithRoles: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
            unsafeBrandId(request.body.userId),
            unsafeBrandId(request.body.tenantId),
            request.body.userRoles.map(apiUserRoleToUserRole),
            ctx
          );
          return reply.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
          return sendApiProblemReply(reply, errorRes);
        }
      },

      deleteTenantNotificationConfig: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.deleteTenantNotificationConfig(
            unsafeBrandId(request.params.tenantId),
            ctx
          );
          return reply.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteTenantNotificationConfigErrorMapper,
            ctx
          );
          return sendApiProblemReply(reply, errorRes);
        }
      },

      removeUserNotificationConfigRole: async (request, reply) => {
        const ctx = fromAppContext(request.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          await notificationConfigService.removeUserNotificationConfigRole(
            unsafeBrandId(request.params.userId),
            unsafeBrandId(request.params.tenantId),
            apiUserRoleToUserRole(request.params.userRole),
            ctx
          );
          return reply.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeUserNotificationConfigRoleErrorMapper,
            ctx
          );
          return sendApiProblemReply(reply, errorRes);
        }
      },
    };

    registerRoutes(
      app,
      handlers,
      notificationConfigApi.notificationConfigOperationRoutes
    );
  };

export default notificationConfigRouter;
