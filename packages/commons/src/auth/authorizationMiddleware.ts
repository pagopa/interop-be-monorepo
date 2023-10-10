import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { NextFunction, Request, Response } from "express";
import {
  CatalogProcessError,
  ErrorTypes,
  Problem,
  makeApiProblem,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ExpressContext, readHeaders } from "../index.js";
import { UserRoles } from "./authData.js";
import { readAuthDataFromJwtToken } from "./jwt.js";

export const authRoleMiddleware: (
  admittedRoles: UserRoles[]
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  (admittedRoles: UserRoles[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const jwtToken = req.headers.authorization?.split(" ")[1];
      if (!jwtToken) {
        throw new CatalogProcessError(
          "The jwt token not found",
          ErrorTypes.Unauthorized
        );
      }
      const authData = readAuthDataFromJwtToken(jwtToken);

      if (authData instanceof Error) {
        // throw new CatalogProcessError(authData.message, ErrorTypes.Unauthorized);
        next();
        return;
      }

      if (!authData.userRoles || authData.userRoles.length === 0) {
        throw new CatalogProcessError(
          "No user roles found to execute this request",
          ErrorTypes.Unauthorized
        );
      }

      const admittedRolesStr = admittedRoles.map((role) =>
        role.toString().toLowerCase()
      );

      const intersection = authData.userRoles.filter((value) =>
        admittedRolesStr.includes(value)
      );

      if (intersection.length === 0) {
        throw new CatalogProcessError(
          `Invalid user roles (${authData.userRoles.join(
            ","
          )}) to execute this request`,
          ErrorTypes.Unauthorized
        );
      }

      return next();
    } catch (err) {
      const headers = readHeaders(req);

      const problem = match<unknown, Problem>(err)
        .with(P.instanceOf(CatalogProcessError), (error) =>
          makeApiProblem(
            error.type.code,
            error.type.httpStatus,
            error.type.title,
            error.message,
            headers?.correlationId
          )
        )
        .otherwise(() =>
          makeApiProblem(
            `${ErrorTypes.GenericError.code}`,
            ErrorTypes.GenericError.httpStatus,
            ErrorTypes.GenericError.title,
            "Generic error while processing catalog process error"
          )
        );
      return res.status(problem.status).json(problem).end();
    }
  };
