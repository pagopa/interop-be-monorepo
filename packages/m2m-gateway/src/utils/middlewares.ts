import { constants } from "http2";
import {
  AppContext,
  ExpressContext,
  Logger,
  M2MAdminAuthData,
  fromAppContext,
  systemRole,
} from "pagopa-interop-commons";
import { unauthorizedError } from "pagopa-interop-models";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { P, match } from "ts-pattern";
import { Request } from "express";
import { makeApiProblem } from "../model/errors.js";
import { M2MGatewayServices } from "../app.js";
import { M2MGatewayAppContext, getInteropHeaders } from "./context.js";

async function validateM2MAdminUserId(
  authData: M2MAdminAuthData,
  clientService: M2MGatewayServices["clientService"],
  headers: M2MGatewayAppContext["headers"],
  logger: Logger
): Promise<void> {
  const clientAdminId = await clientService.getClientAdminId(
    authData.clientId,
    { headers, logger }
  );

  if (clientAdminId !== authData.userId) {
    throw unauthorizedError(
      `User ${authData.userId} is not the adminId associated to client ${authData.clientId}`
    );
  }
}

export function m2mAuthDataValidationMiddleware(
  clientService: M2MGatewayServices["clientService"]
): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    // We assume that:
    // - contextMiddleware already set basic ctx info such as correlationId
    // - authenticationMiddleware already set authData in ctx

    const ctx = fromAppContext((req as Request & { ctx: AppContext }).ctx);
    try {
      await match(ctx.authData)
        .with({ systemRole: systemRole.M2M_ADMIN_ROLE }, (authData) =>
          validateM2MAdminUserId(
            authData,
            clientService,
            getInteropHeaders(ctx, req.headers),
            ctx.logger
          )
        )
        .with({ systemRole: systemRole.M2M_ROLE }, () => {
          // No additional validation needed for M2M_ROLE
        })
        .with(
          {
            systemRole: P.union(
              systemRole.INTERNAL_ROLE,
              systemRole.MAINTENANCE_ROLE,
              undefined
            ),
          },
          (authData) => {
            throw unauthorizedError(
              `Invalid role ${
                authData.systemRole ?? authData.userRoles
              } for this operation`
            );
          }
        )
        .exhaustive();
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        () => constants.HTTP_STATUS_FORBIDDEN,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }

    return next();
  };
}
