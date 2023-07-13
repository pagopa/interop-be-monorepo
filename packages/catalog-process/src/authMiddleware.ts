import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { match, P } from "ts-pattern";
import { ExpressContext } from "./app.js";
import { readClaimsFromJwtToken } from "./auth/jwt.js";
import { CatalogProcessError, ErrorTypes } from "./model/domain/errors.js";
import { ApiError, makeApiError } from "./model/types.js";

export const authMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    return match(authorization)
      .with(P.string, (auth: string) => {
        const authContent = auth.split(" ");
        if (authContent.length !== 2 || authContent[0] !== "Bearer") {
          throw new CatalogProcessError(
            `No Bearer token provided`,
            ErrorTypes.MissingBearer
          );
        }

        const jwtToken = authContent[1];
        const authData = readClaimsFromJwtToken(jwtToken);
        if (authData === null) {
          throw new CatalogProcessError(
            `Invalid claims: token parsing error`,
            ErrorTypes.MissingClaim
          );
        }

        // eslint-disable-next-line functional/immutable-data
        req.authData = authData;
        next();
      })
      .with(P.nullish, () => {
        throw new CatalogProcessError(
          `Bearer token has not been passed`,
          ErrorTypes.MissingBearer
        );
      })
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
