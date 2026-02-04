import { constants } from "http2";
import {
  AppContext,
  ExpressContext,
  M2MAdminAuthData,
  fromAppContext,
  jwtsFromAuthAndDPoPHeaders,
  readAuthDataFromJwtToken,
  systemRole,
  JWTConfig,
  DPoPConfig,
  verifyJwtDPoPToken,
} from "pagopa-interop-commons";
import { unauthorizedError } from "pagopa-interop-models";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { P, match } from "ts-pattern";
import { Request } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb/dist-types/DynamoDBClient.js";
import { Logger } from "pagopa-interop-commons";
import { makeApiProblem } from "../model/errors.js";
import { M2MGatewayServices } from "../app.js";
import { M2MGatewayAppContext, getInteropHeaders } from "./context.js";
import { verifyDPoPCompliance } from "./dpop.js";
import { extractRequestDetails } from "./request.js";

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

export const authenticationDPoPMiddleware: (
  config: JWTConfig & DPoPConfig & { m2mGatewayPublicUrl: string },
  dynamoDBClient: DynamoDBClient
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  (
    config: JWTConfig & DPoPConfig & { m2mGatewayPublicUrl: string },
    dynamoDBClient: DynamoDBClient
  ) =>
  async (req, res, next): Promise<unknown> => {
    // We assume that:
    // - contextMiddleware already set ctx.serviceName and ctx.correlationId
    const ctx = fromAppContext(req.ctx);

    try {
      // ----------------------------------------------------------------------
      // Step 0 – Request Normalization (RFC 9449)
      // Reconstruct the Target URI (HTU) and Method (HTM) from the request
      // to ensure the DPoP proof signature matches the actual call.
      // ----------------------------------------------------------------------
      const { url, method } = extractRequestDetails(
        req,
        config.m2mGatewayPublicUrl
      );

      // ----------------------------------------------------------------------
      // Step 1 – Schema and Presence Verification (Syntax Check)
      // verify HTTP Authorization Header and DPoP Header
      // ----------------------------------------------------------------------
      const { accessToken, dpopProofJWS } = jwtsFromAuthAndDPoPHeaders(
        req,
        ctx.logger
      );

      // ----------------------------------------------------------------------
      // Step 2 & 3 – Access Token Verification & DPoP Enforcement
      // verify JWT Access Token
      // verify all claims (cnf included) are all present in JWT Token (Binding DPoP)
      // ----------------------------------------------------------------------
      const accessTokenDPoP = await verifyJwtDPoPToken(
        accessToken,
        config,
        ctx.logger
      );

      // 4. Full DPoP Validation (Signature, Replay Check, Key Binding)
      await verifyDPoPCompliance({
        config,
        dpopProofJWS,
        accessTokenClientId: accessTokenDPoP.client_id,
        accessTokenThumbprint: accessTokenDPoP.cnf.jkt,
        expectedHtu: url,
        expectedHtm: method,
        dynamoDBClient,
        logger: ctx.logger,
      });

      // eslint-disable-next-line functional/immutable-data
      req.ctx.authData = readAuthDataFromJwtToken(accessTokenDPoP);
      return next();
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with(
              "tokenVerificationFailed",
              "dpopProofValidationFailed",
              "dpopProofSignatureValidationFailed",
              "dpopProofJtiAlreadyUsed",
              "dpopTokenBindingFailed",
              () => 401
            )
            .with("operationForbidden", () => 403)
            .with("missingHeader", "badDPoPToken", "invalidClaim", () => 400)
            .otherwise(() => 500),
        ctx
      );
      return res.status(problem.status).send(problem);
    }
  };
