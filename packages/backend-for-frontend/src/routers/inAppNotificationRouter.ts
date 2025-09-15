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
import { InAppNotificationService } from "../services/inAppNotificationManagerService.js";
import { toBffApiNotificationsCountBySection } from "../api/inAppNotificationApiConverter.js";
import { makeApiProblem } from "../model/errors.js";

const inAppNotificationRouter = (
  ctx: ZodiosContext,
  inAppNotificationService: InAppNotificationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const inAppNotificationRouter = ctx.router(bffApi.inAppNotificationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  inAppNotificationRouter
    .get("/inAppNotifications", (_, res) => res.status(501).send())
    .post("/inAppNotifications/bulk/markAsRead", (_, res) =>
      res.status(501).send()
    )
    .post("/inAppNotifications/:notificationId/markAsRead", (_, res) =>
      res.status(501).send()
    )
    .delete("/inAppNotifications/:notificationId", (_, res) =>
      res.status(501).send()
    )
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
          "Error creating eservice template"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return inAppNotificationRouter;
};

export default inAppNotificationRouter;
