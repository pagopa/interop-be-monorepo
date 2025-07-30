import { ZodiosRouter } from "@zodios/express";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { bffApi } from "pagopa-interop-api-clients";

const notificationConfigRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const notificationConfigRouter = ctx.router(
    bffApi.notificationConfigsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  notificationConfigRouter
    .get("/tenantNotificationConfigs", (_, res) => res.status(501).send())
    .post("/tenantNotificationConfigs", (_, res) => res.status(501).send())
    .get("/userNotificationConfigs", (_, res) => res.status(501).send())
    .post("/userNotificationConfigs", (_, res) => res.status(501).send());

  return notificationConfigRouter;
};

export default notificationConfigRouter;
