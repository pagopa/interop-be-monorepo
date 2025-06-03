import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  rateLimiterHeadersFromStatus,
} from "pagopa-interop-commons";
import {
  ApiError,
  emptyErrorMapper,
  genericError,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { AuthorizationService } from "../services/authorizationService.js";
import { sessionTokenErrorMapper } from "../utilities/errorMappers.js";
import { config } from "../config/config.js";
import { fromBffAppContext } from "../utilities/context.js";

const authorizationRouter = (
  ctx: ZodiosContext,
  authorizationService: AuthorizationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(bffApi.authorizationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  authorizationRouter
    .post("/session/tokens", async (req, res) => {
      const { identity_token: identityToken } = req.body;
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await authorizationService.getSessionToken(
          identityToken,
          ctx
        );

        const headers = rateLimiterHeadersFromStatus(result.rateLimiterStatus);
        res.set(headers);

        if (result.limitReached) {
          throw tooManyRequestsError(result.rateLimitedTenantId);
        }

        return res
          .status(200)
          .send(bffApi.SessionToken.parse(result.sessionToken));
      } catch (error) {
        ctx.logger.info(
          `Error creating a session token: ${
            error instanceof ApiError ? error.detail : error
          }. Returning a generic error response.`
        );
        const errorRes = makeApiProblem(
          genericError("Error creating a session token"),
          emptyErrorMapper,
          ctx,
          "Error creating a session token"
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/support", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const jwt = await authorizationService.samlLoginCallback(
          req.body.SAMLResponse,
          ctx
        );
        return res.redirect(
          302,
          `${config.samlCallbackUrl}#saml2=${req.body.SAMLResponse}&jwt=${jwt}`
        );
      } catch (error) {
        ctx.logger.error(`Error calling support SAML - ${error}`);
        return res.redirect(302, config.samlCallbackErrorUrl);
      }
    });

  return authorizationRouter;
};

export default authorizationRouter;
