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
import { authorizationApi } from "../model/generated/api.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { config } from "../utilities/config.js";
import { makeApiProblem } from "../utilities/errors.js";

const authorizationRouter = (
  ctx: ZodiosContext,
  { tenantProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(authorizationApi.api, {
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

      const session_token = await authorizationService.getSessionToken(
        correlationId,
        identityToken,
        logger
      );

      return res.status(200).send({ session_token });
    })
    .post("/support", async (req, res) => {
      const saml = Buffer.from(req.body.SAMLResponse, "base64").toString();
      const { correlationId, logger } = fromAppContext(req.ctx);

      try {
        const jwt = await authorizationService.generateJwtFromSaml(
          correlationId,
          saml,
          config.pagoPaTenantId
        );
        return res.redirect(
          302,
          `${config.saml2CallbackUrl}#saml2=${req.body.SAMLResponse}&jwt=${jwt}`
        );
      } catch (error) {
        makeApiProblem(error, (_) => 500, logger);
        return res.redirect(302, config.saml2CallbackErrorUrl);
      }
    });

  return authorizationRouter;
};

export default authorizationRouter;
