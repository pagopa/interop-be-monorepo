import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { tenantServiceBuilder } from "../services/tenantService.js";

const genericRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const genericRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const tenantService = tenantServiceBuilder();

  genericRouter
    .post("/session/tokens", async (req, res) => {
      const { identity_token: identityToken } = req.body;
      const correlationId = req.ctx.correlationId;

      const session_token = await tenantService.getSessionToken(
        correlationId,
        identityToken
      );

      return res.status(200).send({ session_token });
    })
    .post("/tools/validateTokenGeneration", async (_req, res) =>
      res.status(501).send()
    )
    .post("/support", async (_req, res) => res.status(501).send())
    .post("/session/saml2/tokens", async (_req, res) => res.status(501).send());

  return genericRouter;
};

export default genericRouter;
