/* eslint-disable @typescript-eslint/naming-convention */
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  AuthData,
  logger,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { ExpressContext } from "./app.js";
import {
  CatalogProcessError,
  ErrorTypes,
  missingHeader,
} from "./model/domain/errors.js";
import { ApiError, makeApiError } from "./model/types.js";

const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

const Headers = z.object({
  authorization: z.string(),
  "x-correlation-id": z.string(),
  "x-forwarded-for": z.string().ip().optional(),
});

type Headers = z.infer<typeof Headers>;

export const authMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  const addCtxAuthData = (headers: Headers): void => {
    const authorizationHeader = headers.authorization.split(" ");
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
          correlationId: headers["x-correlation-id"],
          ip: headers["x-forwarded-for"],
        };
        next();
      });
  };

  try {
    const headers = Headers.parse(req.headers);
    return match(headers)
      .with(
        {
          authorization: P.string,
          "x-correlation-id": P.string,
          "x-forwarded-for": P.optional(P.string.regex(ipRegex)),
          // "x-forwarded-for": P.nullish.or(P.string.regex(ipRegex)),
        },
        (headers) => addCtxAuthData(headers)
      )
      .with(
        {
          authorization: P.nullish,
          "x-correlation-id": P._,
          "x-forwarded-for": P._,
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
          "x-forwarded-for": P._,
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
    const apiError: ApiError = makeApiError(error);
    return res.status(apiError.status).json(apiError).end();
  }
};
