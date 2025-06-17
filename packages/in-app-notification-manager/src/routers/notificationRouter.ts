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
import { emptyErrorMapper } from "pagopa-interop-models";
import { inAppNotificationApi } from "pagopa-interop-api-clients";
import { InAppNotificationService } from "../services/inAppNotificationService.js";
import { makeApiProblem } from "../model/errors.js";

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
  const { ADMIN_ROLE, API_ROLE } = authRole;

  notificationRouter.get("/notifications", async function (req, res) {
    const ctx = fromAppContext(req.ctx);
    try {
      validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

      const { limit, offset, q } = req.query;
      const notifications = await service.getNotifications(
        q,
        limit,
        offset,
        ctx
      );
      return res.status(200).send(notifications);
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error getting notifications"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return notificationRouter;
};
