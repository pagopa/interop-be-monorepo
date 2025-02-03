/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  makeApiProblemBuilder,
  unauthorizedError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ExpressContext,
  fromAppContext,
  JWTConfig,
  jwtFromAuthHeader,
} from "../index.js";
import { AuthData } from "./authData.js";
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
      const valid = await verifyJwtToken(jwtToken, config, ctx.logger);
      if (!valid) {
        throw unauthorizedError("Invalid token");
      }

      const authData: AuthData = readAuthDataFromJwtToken(jwtToken, ctx.logger);
      // eslint-disable-next-line functional/immutable-data
      req.ctx.authData = authData;
      return next();
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with("unauthorizedError", () => 401)
            .with("operationForbidden", () => 403)
            .with("missingHeader", "badBearerToken", () => 400)
            .otherwise(() => 500),
        ctx.logger,
        ctx.correlationId
      );
      return res.status(problem.status).send(problem);
    }
  };
