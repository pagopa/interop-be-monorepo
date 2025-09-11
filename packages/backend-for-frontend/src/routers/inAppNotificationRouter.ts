import { bffApi } from "pagopa-interop-api-clients";
import { ZodiosRouter } from "@zodios/express";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { ZodiosEndpointDefinitions } from "@zodios/core";

const inAppNotificationRouter = (
  ctx: ZodiosContext
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
    .get("/inAppNotifications/count", (_, res) => res.status(501).send());

  return inAppNotificationRouter;
};

export default inAppNotificationRouter;
