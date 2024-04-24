/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  genericError,
  makeApiProblemBuilder,
  missingBearer,
  missingHeader,
  unauthorizedError,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ExpressContext } from "../index.js";
import { getMutableLoggerContext, logger } from "../logging/index.js";
import { AuthData } from "./authData.js";
import { Headers } from "./headers.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

const makeApiProblem = makeApiProblemBuilder(logger, {});

export const authenticationMiddleware: () => ZodiosRouterContextRequestHandler<ExpressContext> =
  () => {
    const authMiddleware: ZodiosRouterContextRequestHandler<
      ExpressContext
    > = async (req, res, next): Promise<unknown> => {
      const addCtxAuthData = async (
        authHeader: string,
        correlationId: string
      ): Promise<void> => {
        const authorizationHeader = authHeader.split(" ");
        if (
          authorizationHeader.length !== 2 ||
          authorizationHeader[0] !== "Bearer"
        ) {
          logger.warn(
            `No authentication has been provided for this call ${req.method} ${req.url}`
          );
          throw missingBearer;
        }

        const jwtToken = authorizationHeader[1];
        const valid = await verifyJwtToken(jwtToken);
        if (!valid) {
          throw unauthorizedError("Invalid token");
        }

        const authData: AuthData = readAuthDataFromJwtToken(jwtToken);
        const loggerContext = getMutableLoggerContext();
        if (loggerContext) {
          // eslint-disable-next-line functional/immutable-data
          loggerContext.authData = authData;
        } else {
          throw genericError(
            "Cannot set authData in logger context - logger context not found."
          );
        }

        // eslint-disable-next-line functional/immutable-data
        req.ctx = {
          authData: { ...authData },
          correlationId,
        };
        next();
      };

      try {
        const headers = Headers.safeParse(req.headers);
        if (!headers.success) {
          throw missingHeader();
        }

        return await match(headers.data)
          .with(
            {
              authorization: P.string,
              "x-correlation-id": P.string,
            },
            async (headers) =>
              await addCtxAuthData(
                headers.authorization,
                headers["x-correlation-id"]
              )
          )
          .with(
            {
              authorization: P.nullish,
              "x-correlation-id": P._,
            },
            () => {
              logger.warn(
                `No authentication has been provided for this call ${req.method} ${req.url}`
              );

              throw missingBearer;
            }
          )
          .with(
            {
              authorization: P.string,
              "x-correlation-id": P.nullish,
            },
            () => {
              throw missingHeader("x-correlation-id");
            }
          )
          .otherwise(() => {
            throw missingHeader();
          });
      } catch (error) {
        const problem = makeApiProblem(error, (err) =>
          match(err.code)
            .with("unauthorizedError", () => 401)
            .with("operationForbidden", () => 403)
            .with("missingHeader", () => 400)
            .otherwise(() => 500)
        );
        return res.status(problem.status).json(problem).end();
      }
    };

    return authMiddleware;
  };
