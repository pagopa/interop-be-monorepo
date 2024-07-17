/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  makeApiProblemBuilder,
  missingBearer,
  missingHeader,
  unauthorizedError,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ExpressContext } from "../index.js";
import { Logger, logger } from "../logging/index.js";
import { AuthData } from "./authData.js";
import { Headers } from "./headers.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

const makeApiProblem = makeApiProblemBuilder({});

export const authenticationMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = async (req, res, next): Promise<unknown> => {
  const addCtxAuthData = async (
    authHeader: string,
    logger: Logger
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
    const valid = await verifyJwtToken(jwtToken, logger);
    if (!valid) {
      throw unauthorizedError("Invalid token");
    }

    const authData: AuthData = readAuthDataFromJwtToken(jwtToken);
    // eslint-disable-next-line functional/immutable-data
    req.ctx.authData = authData;
    next();
  };

  const loggerInstance = logger({
    serviceName: req.ctx.serviceName,
    correlationId: req.ctx.correlationId,
  });

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
          await addCtxAuthData(headers.authorization, loggerInstance)
      )
      .with(
        {
          authorization: P.nullish,
          "x-correlation-id": P._,
        },
        () => {
          loggerInstance.warn(
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
    const problem = makeApiProblem(
      error,
      (err) =>
        match(err.code)
          .with("unauthorizedError", () => 401)
          .with("operationForbidden", () => 403)
          .with("missingHeader", () => 400)
          .otherwise(() => 500),
      loggerInstance
    );
    return res.status(problem.status).json(problem).end();
  }
};
