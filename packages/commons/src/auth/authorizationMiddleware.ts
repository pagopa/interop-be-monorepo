import {
  ZodiosPathsByMethod,
  ZodiosEndpointDefinition,
  Method,
} from "@zodios/core";
import {
  makeApiProblemBuilder,
  genericError,
  ApiError,
  unauthorizedError,
  CommonErrorCodes,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { Middleware } from "../types/middleware.js";
import { AuthData, fromAppContext, UserRole } from "../index.js";

type RoleValidation =
  | {
      isValid: false;
      error: ApiError<CommonErrorCodes>;
    }
  | { isValid: true };

const hasValidRoles = (
  authData: AuthData,
  admittedRoles: UserRole[]
): RoleValidation => {
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

const makeApiProblem = makeApiProblemBuilder({
  errorCodes: {},
  codePrefix: undefined,
});

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
    // We assume that:
    // - contextMiddleware already set ctx.serviceName and ctx.correlationId
    // - authorizationMiddleware already validated the token and set ctx.authData
    const ctx = fromAppContext(req.ctx);

    try {
      const validationResult = hasValidRoles(ctx.authData, admittedRoles);
      if (!validationResult.isValid) {
        throw validationResult.error;
      }

      return next();
    } catch (err) {
      const problem = match(err)
        .with(P.instanceOf(ApiError), (error) =>
          makeApiProblem(
            error,
            (error) => (error.code === "unauthorizedError" ? 403 : 500),
            ctx.logger,
            ctx.correlationId
          )
        )
        .otherwise(() =>
          makeApiProblem(
            genericError(
              "An unexpected error occurred during authorization checks"
            ),
            () => 500,
            ctx.logger,
            ctx.correlationId
          )
        );

      return (
        res
          .status(problem.status)
          // NOTE(gabro): this is fine, we don't need the type safety provided by Zod since this is a generic middleware.
          // Preserving the type-level machinery to check the correctness of the json body wrt the status code is not worth the effort.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
          .send(problem as any)
      );
    }
  };
