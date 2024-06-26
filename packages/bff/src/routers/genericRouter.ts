import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const genericRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const genericRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  genericRouter
    .post("/tools/validateTokenGeneration", async (_req, res) =>
      res.status(501).send()
    )
    .post("/session/saml2/tokens", async (_req, res) => res.status(501).send());

  return genericRouter;
};

export default genericRouter;
