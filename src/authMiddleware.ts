import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { match, P } from "ts-pattern";
import { ExpressContext } from "./app.js";
import { readClaimsFromJwtToken } from "./auth/jwt.js";
import { CatalogProcessError, ErrorCode } from "./model/domain/errors.js";
import { ApiError, mapAuthorizationErrorToApiError } from "./model/types.js";

export const authMiddleware: ZodiosRouterContextRequestHandler<
  ExpressContext
> = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    return match(authorization)
      .with(P.string, (auth: string) => {
        const authContent = auth.split(" ");

        if (authContent.length !== 2 && authContent[0] !== "Bearer") {
          throw new CatalogProcessError(
            `Bearer token has not been passed`,
            ErrorCode.MissingBearer
          );
        }

        const jwtToken = authContent[1];
        const authData = readClaimsFromJwtToken(jwtToken);
        if (!authData) {
          throw new CatalogProcessError(
            `Invalid claims: token parsing error`,
            ErrorCode.MissingClaim
          );
        }

        // eslint-disable-next-line functional/immutable-data
        req.authData = authData;
        next();
      })
      .with(P.nullish, () => {
        throw new CatalogProcessError(
          `Bearer token has not been passed`,
          ErrorCode.MissingBearer
        );
      })
      .otherwise(() => {
        throw new CatalogProcessError(
          `Header authorization not existing in this request`,
          ErrorCode.MissingHeader
        );
      });
  } catch (error) {
    const errorRes: ApiError = mapAuthorizationErrorToApiError(error);
    return res.status(errorRes.status).json(errorRes).end();
  }
};
