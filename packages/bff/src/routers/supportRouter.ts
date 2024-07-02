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
import { supportApi } from "../model/generated/api.js";

import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { config } from "../utilities/config.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { makeApiProblem } from "../utilities/errors.js";

const supportRouter = (
  ctx: ZodiosContext,
  { tenantProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const supportRouter = ctx.router(supportApi.api, {
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

  supportRouter.post("/session/saml2/tokens", async (req, res) => {
    const { tenantId, saml2 } = req.params;
    const samlDecoded = Buffer.from(saml2, "base64").toString();
    const { correlationId, logger } = fromAppContext(req.ctx);
    try {
      const jwt = await authorizationService.generateJwtFromSaml(
        correlationId,
        samlDecoded,
        tenantId
      );
      return res.status(200).send({ session_token: jwt });
    } catch (error) {
      makeApiProblem(error, (_) => 500, logger);
      return res.status(500).send(); // TODO handle error
    }
  });

  return supportRouter;
};

export default supportRouter;
