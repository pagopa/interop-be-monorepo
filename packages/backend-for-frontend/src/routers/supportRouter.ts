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

import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../model/errors.js";
import { config } from "../config/config.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
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
      makeApiProblem(
        error,
        emptyErrorMapper,
        ctx.logger,
        ctx.correlationId,
        "Error creating a session token"
      );
      return res.status(500).send();
    }
  });

  return supportRouter;
};

export default supportRouter;
