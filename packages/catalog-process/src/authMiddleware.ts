import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { ExpressContext } from "./app.js";
import { ApiError, makeApiError } from "./model/types.js";
import { AuthData } from "./auth/authData.js";
import { readAuthDataFromJwtToken } from "./auth/jwt.js";
import {
  CatalogProcessError,
  ErrorTypes,
  missingHeader,
} from "./model/domain/errors.js";
import { logger } from "./utilities/logger.js";

const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

const Headers = z.object({
  Authorization: z.string(),
  "X-Correlation-Id": z.string(),
  "X-Forwarded-For": z.string().ip().optional(),
});

type Headers = z.infer<typeof Headers>;

export const authMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  const handleJwtToken = (headers: Headers) => {
    const authorizationHeader = headers.Authorization.split(" ");
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
          req.ctx.correlationId = headers["X-Correlation-Id"];
          req.ctx.ip = headers["X-Forwarded-For"];
          next();
        }
      )
      .with(P.instanceOf(Error), (err) => {
        logger.warn(`Invalid authentication provided: ${err.message}`);
        throw new CatalogProcessError(
          `Invalid claims: ${err.message}`,
          ErrorTypes.MissingClaim
        );
      });
  };

  try {
    const headers = Headers.parse(req.headers);
    return match(headers)
      .with(
        {
          Authorization: P.string,
          "X-Correlation-Id": P.string,
          "X-Forwarded-For": P.string.regex(ipRegex).or(P.nullish),
        },
        (headers) => handleJwtToken(headers)
      )
      .with(
        {
          Authorization: P.nullish,
          "X-Correlation-Id": P._,
          "X-Forwarded-For": P._,
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
          Authorization: P.string,
          "X-Correlation-Id": P.nullish,
          "X-Forwarded-For": P._,
        },
        () => missingHeader("X-Correlation-Id")
      )
      .otherwise(() => {
        throw new CatalogProcessError(
          ErrorTypes.MissingHeader.title,
          ErrorTypes.MissingHeader
        );
      });
  } catch (error) {
    const apiError: ApiError = makeApiError(error);
    return res.status(apiError.status).json(apiError).end();
  }
};
