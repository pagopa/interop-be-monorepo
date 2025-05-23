import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  InteropTokenGenerator,
  RateLimiter,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

import {
  ApiError,
  emptyErrorMapper,
  genericError,
} from "pagopa-interop-models";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../model/errors.js";
import { config } from "../config/config.js";
import { fromBffAppContext } from "../utilities/context.js";

const supportRouter = (
  ctx: ZodiosContext,
  { tenantProcessClient }: PagoPAInteropBeClients,
  rateLimiter: RateLimiter
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const supportRouter = ctx.router(bffApi.supportApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const interopTokenGenerator = new InteropTokenGenerator(config);
  const authorizationService = authorizationServiceBuilder(
    interopTokenGenerator,
    tenantProcessClient,
    config.tenantAllowedOrigins,
    rateLimiter
  );

  supportRouter.post("/session/saml2/tokens", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);

    try {
      const sessionToken = await authorizationService.getSaml2Token(
        req.body,
        ctx
      );
      return res.status(200).send(bffApi.SessionToken.parse(sessionToken));
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
  });

  return supportRouter;
};

export default supportRouter;
