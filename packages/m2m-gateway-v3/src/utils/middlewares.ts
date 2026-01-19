import { constants } from "http2";
import {
  AppContext,
  AuthData,
  ExpressContext,
  JWTConfig,
  Logger,
  M2MAdminAuthData,
  fromAppContext,
  parseAuthHeader,
  readAuthDataFromJwtToken,
  systemRole,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { missingHeader, unauthorizedError } from "pagopa-interop-models";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import { P, match } from "ts-pattern";
import { Request } from "express";
import { z } from "zod";
import { makeApiProblem } from "../model/errors.js";
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
  config: JWTConfig
) => ZodiosRouterContextRequestHandler<ExpressContext> =
  (config: JWTConfig) =>
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
      // verify HTTP DPoP Header and Authorization Header
      // ----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { accessToken, dpopProof } = credentialsFromHeaders(
        req,
        ctx.logger
      );

      // ----------------------------------------------------------------------
      // Step 2 – Access Token Validation (Gatekeeper)
      // verify JWT Access Token
      // ----------------------------------------------------------------------
      const { decoded } = await verifyJwtToken(accessToken, config, ctx.logger);

      // ----------------------------------------------------------------------
      // Step 3 – Access Token Binding Verification (cnf)
      // verify all claims (cnf included) are all present in JWT Token (Binding DPoP)
      // ----------------------------------------------------------------------
      const authData = readAuthDataFromJwtToken(decoded);

      // ----------------------------------------------------------------------
      // Step 4a & 4b – DPoP Proof Validation (Static & Crypto)
      // verify DPoP Proof (Claims, HTTP method and HTI, check signature, JTI uniqueness)
      // ----------------------------------------------------------------------

      // ----------------------------------------------------------------------
      // Step 5 – Key Binding Verification (Thumbprint Match)
      // verify binding key between DPoP Proof and JWT Access Token
      // ----------------------------------------------------------------------

      verifyDPoPCnf(authData);

      // eslint-disable-next-line functional/immutable-data
      req.ctx.authData = readAuthDataFromJwtToken(decoded);
      return next();
    } catch (error) {
      const problem = makeApiProblem(
        error,
        (err) =>
          match(err.code)
            .with("tokenVerificationFailed", () => 401)
            .with("operationForbidden", () => 403)
            .with("missingHeader", "badBearerToken", "invalidClaim", () => 400)
            .otherwise(() => 500),
        ctx
      );
      return res.status(problem.status).send(problem);
    }
  };

export function credentialsFromHeaders(
  req: Request,
  logger: Logger
): { accessToken: string; dpopProof: string } {
  const authHeader = parseAuthHeader(req);
  if (!authHeader) {
    throw missingHeader("Authorization");
  }

  const authHeaderParts = authHeader.split(" ");
  if (authHeaderParts.length !== 2 || authHeaderParts[0] !== "DPoP") {
    logger.warn(
      `Invalid authentication provided for this call ${req.method} ${req.url}`
    );
    throw unauthorizedError("Invalid DPoP header format");
  }

  const dpopHeader = parseDPoPHeader(req);
  if (!dpopHeader) {
    logger.warn(`Missing DPoP proof for this call ${req.method} ${req.url}`);
    throw unauthorizedError("Missing DPoP proof");
  }

  return {
    accessToken: authHeaderParts[1],
    dpopProof: dpopHeader,
  };
}

export function parseDPoPHeader(req: Request): string | undefined {
  const parsed = z.object({ dpop: z.string() }).safeParse(req.headers);

  if (parsed.success) {
    return parsed.data.dpop;
  }
  return undefined;
}

function verifyDPoPCnf(authData: AuthData): void {
  if (!("cnf" in authData && authData.cnf !== undefined)) {
    throw unauthorizedError("Invalid DPoP token: missing cnf claim");
  }
}
