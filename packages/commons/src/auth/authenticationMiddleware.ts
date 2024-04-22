/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  makeApiProblemBuilder,
  unauthorizedError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ExpressContext } from "../index.js";
import { logger } from "../logging/index.js";
import { AuthData } from "./authData.js";
import { readHeaders } from "./headers.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

export const authenticationMiddleware: () => ZodiosRouterContextRequestHandler<ExpressContext> =
  () => {
    const authMiddleware: ZodiosRouterContextRequestHandler<
      ExpressContext
    > = async (req, res, next): Promise<void> => {
      const makeApiProblem = makeApiProblemBuilder(logger, {});
      try {
        const { token, correlationId } = readHeaders(req);

        const validationResult = await verifyJwtToken(token);
        if (!validationResult.valid) {
          throw unauthorizedError("Invalid jwt token");
        }
        const authData: AuthData = readAuthDataFromJwtToken(token);
        // eslint-disable-next-line functional/immutable-data
        req.ctx = {
          authData: { ...authData },
          correlationId,
        };
        next();
      } catch (error) {
        const problem = makeApiProblem(error, (err) =>
          match(err.code)
            .with("unauthorizedError", () => 401)
            .with("operationForbidden", () => 403)
            .with("missingHeader", () => 400)
            .otherwise(() => 500)
        );
        res.status(problem.status).json(problem).end();
      }
    };

    return authMiddleware;
  };
