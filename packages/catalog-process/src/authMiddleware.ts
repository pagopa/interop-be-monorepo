/* eslint-disable functional/immutable-data */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { match, P } from "ts-pattern";
import { ExpressContext } from "./app.js";
import { ApiError, makeApiError } from "./model/types.js";
import { AuthData } from "./auth/authData.js";
import { readAuthDataFromJwtToken } from "./auth/jwt.js";
import { CatalogProcessError, ErrorType } from "./model/domain/errors.js";
import { logger } from "./utilities/logger.js";

export const authMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  try {
    const correlationId = req.headers["X-Correlation-Id"];
    const ip = req.headers["X-Forwarded-For"];
    const authBearerToken = req.headers.authorization;

    const headersData = {
      authBearerToken,
      correlationId,
      ip,
    };

    return match(headersData)
      .with(
        {
          authBearerToken: P.string,
          correlationId: P.string,
          ip: P.string.or(P.nullish),
        },
        (headers) => {
          const authContent = headers.authBearerToken.split(" ");
          if (authContent.length !== 2 || authContent[0] !== "Bearer") {
            logger.warn(
              `No authentication has been provided for this call ${req.method} ${req.url}`
            );
            throw new CatalogProcessError(
              "Authorization Illegal header key.",
              ErrorCode.MissingBearer
            );
          }

          const jwtToken = authContent[1];
          const authData = readAuthDataFromJwtToken(jwtToken);

          match(authData)
            .with(
              P.shape({
                organizationId: P.string,
                userId: P.string,
                sub: P.string,
              }),
              (claimsRes: AuthData) => {
                req.ctx.authData = claimsRes;
                req.ctx.correlationId = headers.correlationId;
                req.ctx.ip = headers.ip;
                next();
              }
            )
            .with(P.instanceOf(Error), (err) => {
              logger.warn(`Invalid authentication provided: ${err.message}`);
              throw new CatalogProcessError(
                `Invalid claims: ${err.message}`,
                ErrorCode.MissingClaim
              );
            });
        }
      )
      .with(
        {
          authBearerToken: P.nullish,
          correlationId: P._,
          ip: P._,
        },
        () => {
          logger.warn(
            `No authentication has been provided for this call ${req.method} ${req.url}`
          );

          throw new CatalogProcessError(
            `Bearer token has not been passed`,
            ErrorCode.MissingBearer
          );
        }
      )
      .with(
        {
          authBearerToken: P._,
          correlationId: P.nullish,
          ip: P._,
        },
        () => {
          throw new CatalogProcessError(
            `Invalid claims: token parsing error`,
            ErrorType.MissingClaim
          );
        }

        // eslint-disable-next-line functional/immutable-data
        req.authData = authData;
        next();
      })
      .with(P.nullish, () => {
        throw new CatalogProcessError(
            `Header X-Correlation-Id not existing in this request`,
            ErrorCode.MissingHeader
          );
        }
      )
      .otherwise(() => {
        throw new CatalogProcessError(
          `Header authorization not existing in this request`,
          ErrorTypes.MissingHeader
        );
      });
  } catch (error) {
    const apiError: ApiError = makeApiError(error);
    return res.status(apiError.status).json(apiError).end();
  }
};
