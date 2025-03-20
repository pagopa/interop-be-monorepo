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
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";
import { Middleware } from "../types/middleware.js";
import { AuthData, fromAppContext, userRole } from "../index.js";

const makeApiProblem = makeApiProblemBuilder({});

export const authorizationRole = {
  ...userRole,
  M2M_ROLE: "m2m",
  INTERNAL_ROLE: "internal",
  MAINTENANCE_ROLE: "maintenance",
} as const;

export const AuthorizationRole = z.enum([
  Object.values(authorizationRole)[0],
  ...Object.values(authorizationRole).slice(1),
]);
export type AuthorizationRole = z.infer<typeof AuthorizationRole>;

export function getAuthorizationRolesFromAuthData(
  authData: AuthData
): AuthorizationRole[] {
  return match<AuthData, AuthorizationRole[]>(authData)
    .with({ tokenType: "internal" }, () => [authorizationRole.INTERNAL_ROLE])
    .with({ tokenType: "m2m" }, () => [authorizationRole.M2M_ROLE])
    .with({ tokenType: "maintenance" }, () => [
      authorizationRole.MAINTENANCE_ROLE,
    ])
    .with({ tokenType: "ui" }, (d) => d.userRoles)
    .exhaustive();
}

const assertIsAuthorized = (
  authData: AuthData,
  admittedRoles: AuthorizationRole[]
): void => {
  const authDataRoles = getAuthorizationRolesFromAuthData(authData);

  if (
    !authDataRoles ||
    authDataRoles.length === 0 ||
    !authDataRoles.some((role) => admittedRoles.includes(role))
  ) {
    const userRolesErrorString = match(authData)
      .with(
        { tokenType: "ui" },
        ({ userRoles }) => ` and user roles '${userRoles}'`
      )
      .with(
        { tokenType: "m2m" },
        { tokenType: "internal" },
        { tokenType: "maintenance" },
        () => ""
      )
      .exhaustive();
    throw unauthorizedError(
      `Invalid token type '${authData.tokenType}'${userRolesErrorString} for this operation`
    );
  }
};

export const authorizationMiddleware =
  <
    Api extends ZodiosEndpointDefinition[],
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Context extends z.ZodObject<any>
  >(
    admittedRoles: AuthorizationRole[]
  ): Middleware<Api, M, Path, Context> =>
  (req, res, next) => {
    // We assume that:
    // - contextMiddleware already set ctx.serviceName and ctx.correlationId
    // - authorizationMiddleware already validated the token and set ctx.authData
    const ctx = fromAppContext(req.ctx);

    try {
      assertIsAuthorized(ctx.authData, admittedRoles);
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
