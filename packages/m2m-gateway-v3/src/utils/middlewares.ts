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
import {
  checkDPoPCache,
  verifyDPoPProof,
  verifyDPoPProofSignature,
  verifyDPoPThumbprintMatch,
} from "pagopa-interop-dpop-validation";
import { DPoPProof, unauthorizedError } from "pagopa-interop-models";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { P, match } from "ts-pattern";
import { Request } from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb/dist-types/DynamoDBClient.js";
import { Logger } from "pagopa-interop-commons";
import {
  dpopProofJtiAlreadyUsed,
  dpopProofSignatureValidationFailed,
  dpopProofValidationFailed,
  makeApiProblem,
} from "../model/errors.js";
import { M2MGatewayServices } from "../app.js";
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
  config: JWTConfig & DPoPConfig,
  dynamoDBClient: DynamoDBClient
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  (config: JWTConfig & DPoPConfig, dynamoDBClient: DynamoDBClient) =>
  async (req, res, next): Promise<unknown> => {
    // We assume that:
    // - contextMiddleware already set ctx.serviceName and ctx.correlationId
    const ctx = fromAppContext(req.ctx);

    try {
      // ----------------------------------------------------------------------
      // Step 0 – Request Normalization
      // request normalization to obtain the HTTP method, htm, hti
      // ----------------------------------------------------------------------

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

      // ----------------------------------------------------------------------
      // Step 4a & 4b – DPoP Proof Validation (Static & Crypto)
      // verify DPoP Proof (Claims, HTTP method and HTI, check signature, JTI uniqueness)
      // ----------------------------------------------------------------------
      const { dpopProofJWT } = await validateDPoPProof(
        config,
        dpopProofJWS,
        accessTokenDPoP.client_id,
        ctx.logger
      );
      if (!dpopProofJWT) {
        // TODO: improve error handling
        throw unauthorizedError("Invalid DPoP Proof structure");
      }
      //  JTI uniqueness: Check if the cache contains the DPoP proof
      if (dpopProofJWT) {
        const { errors: dpopCacheErrors } = await checkDPoPCache({
          dynamoDBClient,
          dpopProofJti: dpopProofJWT.payload.jti,
          dpopProofIat: dpopProofJWT.payload.iat,
          dpopCacheTable: config.dpopCacheTable,
          dpopProofDurationSeconds: config.dpopDurationSeconds,
        });
        if (dpopCacheErrors) {
          throw dpopProofJtiAlreadyUsed(dpopProofJWT.payload.jti);
        }
      }

      // eslint-disable-next-line no-console
      // console.log(dpopProofJWT);

      // ----------------------------------------------------------------------
      // Step 5 – Key Binding Verification (Thumbprint Match)
      // verify binding key between DPoP Proof and JWT Access Token
      // ----------------------------------------------------------------------
      const { errors: bindingErrors } = verifyDPoPThumbprintMatch(
        dpopProofJWT,
        accessTokenDPoP.cnf.jkt
      );
      if (bindingErrors) {
        // Logga qui l'errore specifico
        ctx.logger.warn(
          `DPoP Key Binding failed: ${bindingErrors
            .map((e) => e.detail)
            .join(", ")}`
        );

        // Lancia l'eccezione che il catch del middleware trasformerà in 401/403
        throw unauthorizedError(
          "DPoP proof public key hash does not match token binding"
        );
      }

      // eslint-disable-next-line functional/immutable-data
      req.ctx.authData = readAuthDataFromJwtToken(accessTokenDPoP);
      return next();
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with("tokenVerificationFailed", () => 401)
            .with("operationForbidden", () => 403)
            .with(
              "missingHeader",
              "badDPoPToken",
              "badDPoPProof",
              "dpopProofValidationFailed",
              "dpopProofSignatureValidationFailed",
              "dpopProofJtiAlreadyUsed",
              "invalidClaim",
              () => 400
            )
            .otherwise(() => 500),
        ctx
      );
      return res.status(problem.status).send(problem);
    }
  };

const validateDPoPProof = async (
  config: JWTConfig & DPoPConfig,
  dpopProofHeader: string | undefined,
  clientId: string | undefined,
  logger: Logger
): Promise<{
  dpopProofJWS: string | undefined;
  dpopProofJWT: DPoPProof | undefined;
}> => {
  const { data, errors: dpopProofErrors } = dpopProofHeader
    ? verifyDPoPProof({
        dpopProofJWS: dpopProofHeader,
        expectedDPoPProofHtu: config.dpopHtu,
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      })
    : { data: undefined, errors: undefined };

  if (dpopProofErrors) {
    throw dpopProofValidationFailed(
      clientId,
      dpopProofErrors.map((error) => error.detail).join(", ")
    );
  }

  const dpopProofJWT = data?.dpopProofJWT;
  const dpopProofJWS = data?.dpopProofJWS;

  if (dpopProofJWT && dpopProofJWS) {
    const { errors: dpopProofSignatureErrors } = await verifyDPoPProofSignature(
      dpopProofJWS,
      dpopProofJWT.header.jwk
    );

    if (dpopProofSignatureErrors) {
      throw dpopProofSignatureValidationFailed(
        clientId,
        dpopProofSignatureErrors.map((error) => error.detail).join(", ")
      );
    }

    logger.info(`[JTI=${dpopProofJWT.payload.jti}] - DPoP proof validated`);
  }

  return { dpopProofJWS, dpopProofJWT };
};
