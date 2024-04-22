import {
  Problem,
  makeApiProblemBuilder,
  genericError,
  ApiError,
  unauthorizedError,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  ZodiosEndpointDefinition,
  Method,
  ZodiosPathsByMethod,
} from "@zodios/core";
import { z } from "zod";
import { Request } from "express";
import {
  AuthData,
  Middleware,
  UserRole,
  readAuthDataFromJwtToken,
  readHeaders,
} from "../index.js";
import { logger } from "../logging/index.js";

const hasValidRoles = (
  authData: AuthData,
  admittedRoles: UserRole[]
): boolean => {
  if (!authData.userRoles || authData.userRoles.length === 0) {
    throw unauthorizedError("No user roles found to execute this request");
  }

  const admittedRolesStr = admittedRoles.map((role) =>
    role.toString().toLowerCase()
  );

  const intersection = authData.userRoles.filter((value) =>
    admittedRolesStr.includes(value)
  );

  if (intersection.length > 0) {
    return true;
  }

  const userRolesStr = authData.userRoles.join(",");
  throw unauthorizedError(
    `Invalid user roles (${userRolesStr}) to execute this request`
  );
};

export const authorizationMiddleware =
  <
    Api extends ZodiosEndpointDefinition[],
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Context extends z.ZodObject<any>
  >(
    admittedRoles: UserRole[]
  ): Middleware<Api, M, Path, Context> =>
  (req, res, next) => {
    const makeApiProblem = makeApiProblemBuilder(logger, {});
    const { token, correlationId } = readHeaders(req as Request); // after authenticationMiddleware, headers are guaranteed to be present
    const authData = readAuthDataFromJwtToken(token); // after authenticationMiddleware, token is guaranteed to be valid
    try {
      hasValidRoles(authData, admittedRoles);
      return next();
    } catch (err) {
      const problem = match<unknown, Problem>(err)
        .with(P.instanceOf(ApiError), (error) =>
          makeApiProblem(
            new ApiError({
              code: error.code,
              detail: error.detail,
              title: error.title,
              correlationId,
            }),
            (error) => (error.code === "unauthorizedError" ? 403 : 500)
          )
        )
        .otherwise(() =>
          makeApiProblem(
            genericError(
              "An unexpected error occurred during authorization checks"
            ),
            () => 500
          )
        );

      return (
        res
          .status(problem.status)
          // NOTE(gabro): this is fine, we don't need the type safety provided by Zod since this is a generic middleware.
          // Preserving the type-level machinery to check the correctness of the json body wrt the status code is not worth the effort.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
          .json(problem as any)
          .end()
      );
    }
  };
