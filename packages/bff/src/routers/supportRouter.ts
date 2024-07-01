import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { supportApi } from "../model/generated/api.js";

const supportRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const supportRouter = ctx.router(supportApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  supportRouter.post("/session/saml2/tokens", async (_req, res) =>
    res.status(501).send()
  );

  return supportRouter;
};

export default supportRouter;
