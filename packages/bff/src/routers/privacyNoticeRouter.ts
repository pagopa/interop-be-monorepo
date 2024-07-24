import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const privacyNoticeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const privacyNoticeRouter = ctx.router(bffApi.privacyNoticesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  privacyNoticeRouter
    .get("/user/consent/:consentType", async (_req, res) =>
      res.status(501).send()
    )
    .post("/user/consent/:consentType", async (_req, res) =>
      res.status(501).send()
    )
    .get("/privacyNotices/:consentType", async (_req, res) =>
      res.status(501).send()
    );

  return privacyNoticeRouter;
};

export default privacyNoticeRouter;
