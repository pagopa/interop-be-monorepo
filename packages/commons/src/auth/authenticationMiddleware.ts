/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  makeApiProblemBuilder,
  unauthorizedError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ExpressContext,
  getJwksClients,
  JWTConfig,
  jwtFromAuthHeader,
} from "../index.js";
import { logger } from "../logging/index.js";
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
    const loggerInstance = logger({
      serviceName: req.ctx.serviceName,
      correlationId: req.ctx.correlationId,
    });

    try {
      const jwksClients = getJwksClients(config);

      const jwtToken = jwtFromAuthHeader(req, loggerInstance);
      const valid = await verifyJwtToken(
        jwtToken,
        jwksClients,
        config,
        loggerInstance
      );
      if (!valid) {
        throw unauthorizedError("Invalid token");
      }

      const authData: AuthData = readAuthDataFromJwtToken(
        jwtToken,
        loggerInstance
      );
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
            .with("missingHeader", "badBearer", () => 400)
            .otherwise(() => 500),
        loggerInstance
      );
      return res.status(problem.status).send(problem);
    }
  };
