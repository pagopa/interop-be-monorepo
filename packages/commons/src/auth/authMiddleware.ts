/* eslint-disable @typescript-eslint/naming-convention */
import {
  zodiosContext,
  ZodiosRouterContextRequestHandler,
} from "@zodios/express";
import { Response } from "express";
import { z } from "zod";
import { P, match } from "ts-pattern";
import {
  CatalogProcessError,
  ErrorTypes,
  missingHeader,
} from "pagopa-interop-models";
import { logger } from "../logging/index.js";
import { ctx } from "../context/index.js";
import { AuthData } from "./authData.js";
import { Headers } from "./headers.js";
import { readAuthDataFromJwtToken, verifyJwtToken } from "./jwt.js";

const zodiosCtx = zodiosContext(z.object({ ctx }));
export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

export const makeAuthMiddleware: (
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
        throw new CatalogProcessError(
          "Authorization Illegal header key.",
          ErrorTypes.MissingBearer
        );
      }

      const jwtToken = authorizationHeader[1];
      const valid = await verifyJwtToken(jwtToken);
      if (!valid) {
        logger.warn(`The jwt token is not valid`);
        throw new CatalogProcessError(
          "The jwt token is not valid",
          ErrorTypes.Unauthorized
        );
      }
      const authData = readAuthDataFromJwtToken(jwtToken);
      match(authData)
        .with(P.instanceOf(Error), (err) => {
          logger.warn(`Invalid authentication provided: ${err.message}`);
          throw new CatalogProcessError(
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
      const headers = Headers.parse(req.headers);
      return await match(headers)
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

            throw new CatalogProcessError(
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
        .otherwise(() => {
          throw new CatalogProcessError(
            ErrorTypes.MissingHeader.title,
            ErrorTypes.MissingHeader
          );
        });
    } catch (error) {
      return apiErrorHandler(error, res);
    }
  };

  return authMiddleware;
};
