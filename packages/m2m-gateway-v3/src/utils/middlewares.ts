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
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { makeApiProblem } from "../model/errors.js";
import { M2MGatewayServices } from "../app.js";
import {
  checkDPoPCache,
  verifyDPoPProof,
} from "../../../dpop-validation/src/validation.js";
import { M2MGatewayConfig } from "../config/config.js";
import { M2MGatewayAppContext, getInteropHeaders } from "./context.js";

export async function validateM2MAdminUserId(
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
  clientService: M2MGatewayServices["clientService"],
  config: M2MGatewayConfig,
  dynamoDBClient: DynamoDBClient
): ZodiosRouterContextRequestHandler<ExpressContext> {
  return async (req, res, next) => {
    const ctx = fromAppContext((req as Request & { ctx: AppContext }).ctx);

    try {
      const dpopHeader = req.headers.dpop;

      if (dpopHeader) {
        const validation = verifyDPoPProof({
          dpopProofJWS: dpopHeader as string,
          expectedDPoPProofHtu: `${config.dpopHtu}${req.originalUrl}`,
          dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
          dpopProofDurationSeconds: config.dpopDurationSeconds,
        });

        if (!("data" in validation) || !validation.data) {
          throw unauthorizedError("DPoP validation failed");
        }
        // maybe no need to check "data" again
        if ("data" in validation && validation.data) {
          const { dpopProofJWT } = validation.data;

          const cacheValidation = await checkDPoPCache({
            dynamoDBClient,
            dpopProofJti: dpopProofJWT.payload.jti,
            dpopProofIat: dpopProofJWT.payload.iat,
            dpopCacheTable: config.dpopCacheTable,
            dpopProofDurationSeconds: config.dpopDurationSeconds,
          });

          if ("errors" in cacheValidation) {
            throw unauthorizedError(
              "DPoP JTI already used (replay attack detected)"
            );
          }
        } else {
          throw unauthorizedError("Invalid DPoP validation state");
        }
      }

      // Prosegue con la validazione dei ruoli esistente
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

      return next();
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        () => constants.HTTP_STATUS_FORBIDDEN,
        ctx
      );
      return res.status(errorRes.status).send(errorRes);
    }
  };
}
