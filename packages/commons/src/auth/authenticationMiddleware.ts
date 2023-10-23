/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { Response } from "express";
import { ErrorTypes, ProcessError, missingHeader } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ExpressContext } from "../index.js";
import { logger } from "../logging/index.js";
import { AuthData } from "./authData.js";
import { Headers } from "./headers.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

export const authenticationMiddleware: (
  apiErrorHandler: (err: unknown, res: Response) => void
) => ZodiosRouterContextRequestHandler<ExpressContext> = (apiErrorHandler) => {
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
        throw new ProcessError(
          "Authorization Illegal header key.",
          ErrorTypes.MissingBearer
        );
      }

      const jwtToken = authorizationHeader[1];
      const valid = await verifyJwtToken(jwtToken);
      if (!valid) {
        logger.warn(`The jwt token is not valid`);
        throw new ProcessError(
          "The jwt token is not valid",
          ErrorTypes.Unauthorized
        );
      }
      const authData = readAuthDataFromJwtToken(jwtToken);
      match(authData)
        .with(P.instanceOf(Error), (err) => {
          logger.warn(`Invalid authentication provided: ${err.message}`);
          throw new ProcessError(
            `Invalid claims: ${err.message}`,
            ErrorTypes.MissingClaim
          );
        })
        .otherwise((claimsRes: AuthData) => {
          // eslint-disable-next-line functional/immutable-data
          req.ctx = {
            authData: { ...claimsRes },
            correlationId,
          };
          next();
        });
    };

    try {
      const headers = Headers.safeParse(req.headers);
      if (!headers.success) {
        throw new ProcessError(
          ErrorTypes.MissingHeader.title,
          ErrorTypes.MissingHeader
        );
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

            throw new ProcessError(
              `Bearer token has not been passed`,
              ErrorTypes.MissingBearer
            );
          }
        )
        .with(
          {
            authorization: P.string,
            "x-correlation-id": P.nullish,
          },
          () => missingHeader("x-correlation-id")
        )
        .otherwise(() =>
          apiErrorHandler(
            new ProcessError(
              ErrorTypes.MissingHeader.title,
              ErrorTypes.MissingHeader
            ),
            res
          )
        );
    } catch (error) {
      return apiErrorHandler(error, res);
    }
  };

  return authMiddleware;
};
