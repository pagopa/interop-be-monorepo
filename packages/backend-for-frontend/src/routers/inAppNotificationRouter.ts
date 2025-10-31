import { bffApi } from "pagopa-interop-api-clients";
import { ZodiosRouter } from "@zodios/express";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { emptyErrorMapper } from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { InAppNotificationService } from "../services/inAppNotificationService.js";
import {
  toBffApiNotification,
  toBffApiNotificationsCountBySection,
} from "../api/inAppNotificationApiConverter.js";
import { makeApiProblem } from "../model/errors.js";

const inAppNotificationRouter = (
  ctx: ZodiosContext,
  inAppNotificationService: InAppNotificationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const inAppNotificationRouter = ctx.router(bffApi.inAppNotificationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  inAppNotificationRouter
    .get("/inAppNotifications", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { q, offset, limit, category } = req.query;

      try {
        const notifications = await inAppNotificationService.getNotifications(
          q,
          category,
          offset,
          limit,
          ctx
        );
        return res.status(200).send(
          bffApi.Notifications.parse({
            pagination: {
              offset,
              limit,
              totalCount: notifications.totalCount,
            },
            results: notifications.results.map(toBffApiNotification),
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error getting in-app notifications"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/inAppNotifications/bulk/markAsRead", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await inAppNotificationService.markNotificationsAsRead(
          req.body.ids,
          ctx
        );
        return res.status(200).send();
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
    .post("/inAppNotifications/bulk/markAsUnread", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await inAppNotificationService.markNotificationsAsUnread(
          req.body.ids,
          ctx
        );
        return res.status(200).send();
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
      "/inAppNotifications/:notificationId/markAsRead",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await inAppNotificationService.markNotificationAsRead(
            req.params.notificationId,
            ctx
          );
          return res.status(200).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            "Error marking notification as read"
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/inAppNotifications/:notificationId/markAsUnread",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          await inAppNotificationService.markNotificationAsUnread(
            req.params.notificationId,
            ctx
          );
          return res.status(200).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            "Error marking notification as unread"
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/inAppNotifications/markAsReadByEntityId/:entityId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        const { entityId } = req.params;

        try {
          await inAppNotificationService.markAsReadByEntityId(entityId, ctx);
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            "Error marking in-app notifications as read by entity id"
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete("/inAppNotifications", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await inAppNotificationService.deleteNotifications(req.body.ids, ctx);
        return res.status(200).send();
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
    .delete("/inAppNotifications/:notificationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await inAppNotificationService.deleteNotification(
          req.params.notificationId,
          ctx
        );
        return res.status(200).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error deleting notification"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/inAppNotifications/count", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const notificationCount =
          await inAppNotificationService.getNotificationsByType(ctx);
        return res
          .status(200)
          .send(
            bffApi.NotificationsCountBySection.parse(
              toBffApiNotificationsCountBySection(notificationCount)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error calculating in-app notifications count"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return inAppNotificationRouter;
};

export default inAppNotificationRouter;
