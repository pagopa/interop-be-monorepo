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
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { fromBffAppContext } from "../utilities/context.js";
import handleResponse from "../utilities/handleResponse.js";

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
    const { tenantId, saml2 } = req.params;
    const ctx = fromBffAppContext(req.ctx, req.headers);

    try {
      const samlDecoded = Buffer.from(saml2, "base64").toString();
      const jwt = await authorizationService.getSaml2Token(
        samlDecoded,
        tenantId,
        ctx
      );
      return handleResponse(
        res,
        200,
        { session_token: jwt },
        bffApi.SessionToken
      );
    } catch (error) {
      makeApiProblem(
        error,
        emptyErrorMapper,
        ctx.logger,
        "Error creating a session token"
      );
      return handleResponse(res, 500);
    }
  });

  return supportRouter;
};

export default supportRouter;
