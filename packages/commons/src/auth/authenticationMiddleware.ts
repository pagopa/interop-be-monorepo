/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { makeApiProblemBuilder } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ExpressContext, fromAppContext } from "../context/context.js";
import { JWTConfig } from "../config/httpServiceConfig.js";
import { credentialsFromDPoPHeader, jwtFromAuthHeader } from "./headers.js";
import {
  readAuthDataFromJwtDPoPToken,
  readAuthDataFromJwtToken,
  verifyJwtToken,
} from "./jwt.js";

const makeApiProblem = makeApiProblemBuilder({});

export const authenticationMiddleware: (
  config: JWTConfig
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  (config: JWTConfig) =>
  async (req, res, next): Promise<unknown> => {
    // We assume that:
    // - contextMiddleware already set ctx.serviceName and ctx.correlationId
    const ctx = fromAppContext(req.ctx);

    try {
      if (config.dpopEnabled) {
        const { accessToken } = credentialsFromDPoPHeader(req, ctx.logger);
        const { decoded } = await verifyJwtToken(
          accessToken,
          config,
          ctx.logger
        );
        // Verify DPoP proof
        // controllo del cnf del token di accesso e del dpop proof
        // oppure verifichiamo il cnf in gatewayV3??
        // eslint-disable-next-line functional/immutable-data
        req.ctx.authData = readAuthDataFromJwtDPoPToken(decoded);
      } else {
        const jwtToken = jwtFromAuthHeader(req, ctx.logger);
        const { decoded } = await verifyJwtToken(jwtToken, config, ctx.logger);

        // eslint-disable-next-line functional/immutable-data
        req.ctx.authData = readAuthDataFromJwtToken(decoded);
      }
      return next();
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with("tokenVerificationFailed", () => 401)
            .with("operationForbidden", () => 403)
            .with("missingHeader", "badBearerToken", "invalidClaim", () => 400)
            .otherwise(() => 500),
        ctx
      );
      return res.status(problem.status).send(problem);
    }
  };
