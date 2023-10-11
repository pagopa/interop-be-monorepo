import {
  ZodiosPathsByMethod,
  ZodiosEndpointDefinition,
  Method,
} from "@zodios/core";
import { ZodiosRequestHandler } from "@zodios/express";
import { Request } from "express";
import {
  CatalogProcessError,
  ErrorTypes,
  Problem,
  makeApiProblem,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { readHeaders } from "../index.js";
import { UserRoles } from "./authData.js";
import { readAuthDataFromJwtToken } from "./jwt.js";

type RoleValidation =
  | {
      isValid: false;
      error: CatalogProcessError;
    }
  | { isValid: true };

export const hasValidRoles = (
  req: Request,
  admittedRoles: UserRoles[]
): RoleValidation => {
  const jwtToken = req.headers.authorization?.split(" ")[1];
  if (!jwtToken) {
    throw new CatalogProcessError(
      "The jwt token not found",
      ErrorTypes.Unauthorized
    );
  }
  const authData = readAuthDataFromJwtToken(jwtToken);

  if (authData instanceof Error) {
    return {
      isValid: false,
      error: new CatalogProcessError(authData.message, ErrorTypes.Unauthorized),
    };
  }

  if (!authData.userRoles || authData.userRoles.length === 0) {
    return {
      isValid: false,
      error: new CatalogProcessError(
        "No user roles found to execute this request",
        ErrorTypes.Unauthorized
      ),
    };
  }

  const admittedRolesStr = admittedRoles.map((role) =>
    role.toString().toLowerCase()
  );

  const intersection = authData.userRoles.filter((value) =>
    admittedRolesStr.includes(value)
  );

  return intersection.length > 0
    ? { isValid: true }
    : {
        isValid: false,
        error: new CatalogProcessError(
          `Invalid user roles (${authData.userRoles.join(
            ","
          )}) to execute this request`,
          ErrorTypes.Unauthorized
        ),
      };
};

type Middleware<
  Api extends ZodiosEndpointDefinition[],
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Context extends z.ZodObject<any>
> = ZodiosRequestHandler<Api, Context, M, Path>;

export const authRoleMiddleware =
  <
    Api extends ZodiosEndpointDefinition[],
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Context extends z.ZodObject<any>
  >(
    admittedRoles: UserRoles[]
  ): Middleware<Api, M, Path, Context> =>
  (req, res, next) => {
    try {
      const validationResult = hasValidRoles(req as Request, admittedRoles);
      if (!validationResult.isValid) {
        throw validationResult.error;
      }

      return next();
    } catch (err) {
      const headers = readHeaders(req as Request);

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

      res.json();

      return (
        res
          .status(problem.status)
          // NOTE(gabro): this is fine, we don't need the type safety provided by Zod since this is a generic middleware.
          // Preserving the type-level machinery to check the correctness of the json body wrt the status code is not worth the effort.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .json(problem as any)
          .end()
      );
    }
  };
