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
    .get("/in-app-notifications", (_, res) => res.status(501).send())
    .post("/in-app-notifications/bulk/markAsRead", (_, res) =>
      res.status(501).send()
    )
    .post("/in-app-notifications/:notificationId/markAsRead", (_, res) =>
      res.status(501).send()
    )
    .delete("/in-app-notifications/:notificationId", (_, res) =>
      res.status(501).send()
    );

  return inAppNotificationRouter;
};

export default inAppNotificationRouter;
