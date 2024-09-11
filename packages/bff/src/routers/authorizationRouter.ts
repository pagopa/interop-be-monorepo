import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  InteropTokenGenerator,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
  RateLimiter,
  rateLimiterHeadersFromStatus,
} from "pagopa-interop-commons";
import { tooManyRequestsError } from "pagopa-interop-models";
import { makeApiProblem } from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import {
  emptyErrorMapper,
  sessionTokenErrorMapper,
} from "../utilities/errorMappers.js";
import { config } from "../config/config.js";

const authorizationRouter = (
  ctx: ZodiosContext,
  { tenantProcessClient }: PagoPAInteropBeClients,
  allowList: string[],
  rateLimiter: RateLimiter
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(bffApi.authorizationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const interopTokenGenerator = new InteropTokenGenerator(config);
  const authorizationService = authorizationServiceBuilder(
    interopTokenGenerator,
    tenantProcessClient,
    allowList,
    rateLimiter
  );

  authorizationRouter
    .post("/session/tokens", async (req, res) => {
      const { identity_token: identityToken } = req.body;
      const { correlationId, logger } = fromAppContext(req.ctx);

      try {
        const result = await authorizationService.getSessionToken(
          correlationId,
          identityToken,
          logger
        );

        const headers = rateLimiterHeadersFromStatus(result.rateLimiterStatus);
        res.set(headers);

        if (result.limitReached) {
          throw tooManyRequestsError(result.rateLimitedTenantId);
        }

        return res.status(200).send({ session_token: result.sessionToken });
      } catch (error) {
        const err = makeApiProblem(
          error,
          sessionTokenErrorMapper,
          logger,
          "Error creating a session token"
        );

        return res.status(err.status).send();
      }
    })
    .post("/support", async (req, res) => {
      const { correlationId, logger } = fromAppContext(req.ctx);

      try {
        const saml = Buffer.from(req.body.SAMLResponse, "base64").toString();

        const jwt = await authorizationService.generateJwtFromSaml(
          correlationId,
          saml,
          config.pagoPaTenantId
        );
        return res.redirect(
          302,
          `${config.samlCallbackUrl}#saml2=${req.body.SAMLResponse}&jwt=${jwt}`
        );
      } catch (error) {
        logger.error(`Error calling support SAML - ${error}`);
        makeApiProblem(error, emptyErrorMapper, logger);
        return res.redirect(302, config.samlCallbackErrorUrl);
      }
    });

  return authorizationRouter;
};

export default authorizationRouter;
