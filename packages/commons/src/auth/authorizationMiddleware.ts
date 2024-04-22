import {
  Problem,
  makeApiProblemBuilder,
  genericError,
  ApiError,
  unauthorizedError,
  CommonErrorCodes,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { ExpressContext, UserRole, readHeaders } from "../index.js";
import { logger } from "../logging/index.js";
import { readAuthDataFromJwtToken } from "./jwt.js";

type RoleValidation =
  | {
      isValid: false;
      error: ApiError<CommonErrorCodes>;
    }
  | { isValid: true };

const hasValidRoles = (
  token: string,
  admittedRoles: UserRole[]
): RoleValidation => {
  const authData = readAuthDataFromJwtToken(token);

  if (authData instanceof Error) {
    return {
      isValid: false,
      error: unauthorizedError(authData.message),
    };
  }

  if (!authData.userRoles || authData.userRoles.length === 0) {
    return {
      isValid: false,
      error: unauthorizedError("No user roles found to execute this request"),
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
        error: unauthorizedError(
          `Invalid user roles (${authData.userRoles.join(
            ","
          )}) to execute this request`
        ),
      };
};

export const authorizationMiddleware: (
  admittedRoles: UserRole[]
) => ZodiosRouterContextRequestHandler<ExpressContext> = (admittedRoles) => {
  const authorizationMiddleware: ZodiosRouterContextRequestHandler<
    ExpressContext
  > = async (req, res, next): Promise<unknown> => {
    const makeApiProblem = makeApiProblemBuilder(logger, {});
    const { token, correlationId } = readHeaders(req); // after authenticationMiddleware, headers are guaranteed to be present
    try {
      const validationResult = hasValidRoles(token, admittedRoles);
      if (!validationResult.isValid) {
        throw validationResult.error;
      }

      return next();
    } catch (err) {
      // TODO base this part on https://github.com/pagopa/interop-be-monorepo/pull/42
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

  return authorizationMiddleware;
};
