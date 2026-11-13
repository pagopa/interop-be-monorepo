/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { constants } from "http2";
import { makeApiProblemBuilder } from "pagopa-interop-models";
import { match } from "ts-pattern";

import { JWTConfig } from "../config/httpServiceConfig.js";
import { ExpressContext, fromAppContext } from "../context/context.js";
import { jwtFromAuthHeader } from "./headers.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

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
      const jwtToken = jwtFromAuthHeader(req, ctx.logger);
      const { decoded } = await verifyJwtToken(jwtToken, config, ctx.logger);

      // eslint-disable-next-line functional/immutable-data
      req.ctx.authData = readAuthDataFromJwtToken(decoded);
      return next();
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with(
              "tokenVerificationFailed",
              () => constants.HTTP_STATUS_UNAUTHORIZED
            )
            .with("operationForbidden", () => constants.HTTP_STATUS_FORBIDDEN)
            .with(
              "missingHeader",
              "badBearerToken",
              "invalidClaim",
              () => constants.HTTP_STATUS_BAD_REQUEST
            )
            .otherwise(() => constants.HTTP_STATUS_INTERNAL_SERVER_ERROR),
        ctx
      );
      return res.status(problem.status).send(problem);
    }
  };
