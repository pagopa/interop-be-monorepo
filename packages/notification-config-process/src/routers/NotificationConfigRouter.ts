import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  fromAppContext,
  authRole,
  validateAuthorization,
} from "pagopa-interop-commons";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { z } from "zod";
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

    app.get("/tenantNotificationConfigs", async (request, reply) => {
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
        return reply.status(errorRes.status).send(errorRes);
      }
    });

    app.get("/userNotificationConfigs", async (request, reply) => {
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
        return reply.status(errorRes.status).send(errorRes);
      }
    });

    app.post<{
      Body: z.infer<
        typeof notificationConfigApi.zTenantNotificationConfigUpdateSeed
      >;
    }>(
      "/tenantNotificationConfigs",
      {
        schema: {
          body: notificationConfigApi.zTenantNotificationConfigUpdateSeed.strict(),
        },
      },
      async (request, reply) => {
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
          return reply.status(errorRes.status).send(errorRes);
        }
      }
    );

    app.post<{
      Body: z.infer<
        typeof notificationConfigApi.zUserNotificationConfigUpdateSeed
      >;
    }>(
      "/userNotificationConfigs",
      {
        schema: {
          body: notificationConfigApi.zUserNotificationConfigUpdateSeed.strict(),
        },
      },
      async (request, reply) => {
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
          return reply.status(errorRes.status).send(errorRes);
        }
      }
    );

    app.post<{
      Body: z.infer<typeof notificationConfigApi.zTenantNotificationConfigSeed>;
    }>(
      "/internal/tenantNotificationConfigs",
      {
        schema: {
          body: notificationConfigApi.zTenantNotificationConfigSeed.strict(),
        },
      },
      async (request, reply) => {
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
          return reply.status(errorRes.status).send(errorRes);
        }
      }
    );

    app.post<{
      Body: z.infer<typeof notificationConfigApi.zUserNotificationConfigSeed>;
    }>(
      "/internal/ensureUserNotificationConfigExistsWithRoles",
      {
        schema: {
          body: notificationConfigApi.zUserNotificationConfigSeed.strict(),
        },
      },
      async (request, reply) => {
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
          return reply.status(errorRes.status).send(errorRes);
        }
      }
    );

    app.delete<{ Params: { tenantId: string } }>(
      "/internal/tenantNotificationConfigs/tenantId/:tenantId",
      {
        schema: {
          params:
            notificationConfigApi.zDeleteTenantNotificationConfigData.shape
              .path,
        },
      },
      async (request, reply) => {
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
          return reply.status(errorRes.status).send(errorRes);
        }
      }
    );

    app.delete<{
      Params: {
        tenantId: string;
        userId: string;
        userRole: notificationConfigApi.UserRole;
      };
    }>(
      "/internal/userNotificationConfigs/tenantId/:tenantId/userId/:userId/userRole/:userRole",
      {
        schema: {
          params:
            notificationConfigApi.zRemoveUserNotificationConfigRoleData.shape
              .path,
        },
      },
      async (request, reply) => {
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
          return reply.status(errorRes.status).send(errorRes);
        }
      }
    );
  };

export default notificationConfigRouter;
