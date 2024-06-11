import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const privacyNoticeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const privacyNoticeRouter = ctx.router(api.api, {
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
