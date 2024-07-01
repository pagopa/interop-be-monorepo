import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  InteropTokenGenerator,
  SessionTokenGenerator,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { config } from "../utilities/config.js";

const authorizationRouter = (
  ctx: ZodiosContext,
  { tenantProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const interopTokenGenerator = new InteropTokenGenerator(config);
  const sessionTokenGenerator = new SessionTokenGenerator(config);
  const authorizationService = authorizationServiceBuilder(
    interopTokenGenerator,
    sessionTokenGenerator,
    tenantProcessClient,
    config.tenantAllowedOrigins
  );

  authorizationRouter
    .post("/session/tokens", async (req, res) => {
      const { identity_token: identityToken } = req.body;
      const { correlationId, logger } = fromAppContext(req.ctx);

      logger.debug("Received request to /session/tokens");

      try {
        const session_token = await authorizationService.getSessionToken(
          correlationId,
          identityToken,
          logger
        );
        return res.status(200).send({ session_token });
      } catch (error) {
        logger.error(error);
        return res.status(500).send();
      }
    })
    .post("/support", async (_req, res) => res.status(501).send());

  return authorizationRouter;
};

export default authorizationRouter;
