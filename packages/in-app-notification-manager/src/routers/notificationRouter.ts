import {
  authRole,
  ExpressContext,
  fromAppContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  emptyErrorMapper,
  NotificationId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { InAppNotificationService } from "../services/inAppNotificationService.js";
import { makeApiProblem } from "../model/errors.js";
import { notificationToApiNotification } from "../model/apiConverter.js";
import {
  markNotificationAsReadErrorMapper,
  deleteNotificationErrorMapper,
  markNotificationAsUnreadErrorMapper,
} from "../utilities/errorMappers.js";

export const notificationRouter = (
  zodiosCtx: ZodiosContext,
  service: InAppNotificationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const notificationRouter = zodiosCtx.router(
    inAppNotificationApi.notificationApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE } = authRole;

  notificationRouter
    .get("/notifications", async function (req, res) {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const { limit, offset, q } = req.query;
        const { results, totalCount } = await service.getNotifications(
          q,
          limit,
          offset,
          ctx
        );
        return res.status(200).send(
          inAppNotificationApi.Notifications.parse({
            results: results.map(notificationToApiNotification),
            totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting notifications"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/notifications/bulk/markAsRead", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const { ids } = req.body;
        await service.markNotificationsAsRead(
          ids.map(unsafeBrandId<NotificationId>),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error marking notifications as read"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/notifications/:notificationId/markAsRead",
      async function (req, res) {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

          const { notificationId } = req.params;
          await service.markNotificationAsRead(
            unsafeBrandId(notificationId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            markNotificationAsReadErrorMapper,
            ctx,
            "Error marking notification as read"
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/notifications/bulk/markAsUnread", async function (req, res) {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const { ids } = req.body;
        await service.markNotificationsAsUnread(
          ids.map(unsafeBrandId<NotificationId>),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error marking notifications as unread"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/notifications/:notificationId/markAsUnread",
      async function (req, res) {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

          const { notificationId } = req.params;
          await service.markNotificationAsUnread(
            unsafeBrandId(notificationId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            markNotificationAsUnreadErrorMapper,
            ctx,
            "Error marking notification as unread"
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/notifications/markAsReadByEntityId/:entityId",
      async function (req, res) {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

          const { entityId } = req.params;
          await service.markNotificationsAsReadByEntityId(entityId, ctx);
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            "Error marking notifications as read by entity ID"
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete("/notifications", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const { ids } = req.body;
        await service.deleteNotifications(
          ids.map(unsafeBrandId<NotificationId>),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error deleting notifications"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/notifications/:notificationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const { notificationId } = req.params;
        await service.deleteNotification(unsafeBrandId(notificationId), ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deleteNotificationErrorMapper,
          ctx,
          "Error deleting notification"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/notifications/byType", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const notificationsByType = await service.getNotificationsByType(ctx);
        return res
          .status(200)
          .send(
            inAppNotificationApi.NotificationsByType.parse(notificationsByType)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting notifications by type"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return notificationRouter;
};
