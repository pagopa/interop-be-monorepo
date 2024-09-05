import {
  AuthToken,
  CustomClaims,
  InteropTokenGenerator,
  Logger,
  ORGANIZATION,
  ORGANIZATION_EXTERNAL_ID_CLAIM,
  ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM,
  ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM,
  ORGANIZATION_ID_CLAIM,
  RateLimiter,
  RateLimiterStatus,
  SELFCARE_ID_CLAIM,
  SessionClaims,
  USER_ROLES,
  decodeJwtToken,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { genericError, TenantId, unsafeBrandId } from "pagopa-interop-models";
import {
  missingClaim,
  tenantLoginNotAllowed,
  tokenVerificationFailed,
} from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { config } from "../config/config.js";

type GetSessionTokenReturnType =
  | {
      limitReached: true;
      sessionToken: undefined;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    }
  | {
      limitReached: false;
      sessionToken: string;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  interopTokenGenerator: InteropTokenGenerator,
  tenantProcessClient: PagoPAInteropBeClients["tenantProcessClient"],
  allowList: string[],
  rateLimiter: RateLimiter
) {
  const readJwt = async (
    identityToken: string,
    logger: Logger
  ): Promise<{
    roles: string;
    sessionClaims: SessionClaims;
    selfcareId: string;
  }> => {
    const verified = await verifyJwtToken(identityToken, logger);
    if (!verified) {
      throw tokenVerificationFailed();
    }

    const decoded = decodeJwtToken(identityToken);

    const {
      success: validToken,
      data: token,
      error,
    } = AuthToken.safeParse(decoded);
    if (!validToken) {
      const claim = error?.errors[0]?.path.join(".");
      throw missingClaim(claim);
    }

    if (token.role) {
      throw genericError("User roles in context are not in valid format");
    }

    const sessionClaims = SessionClaims.parse(token);

    const selfcareId = token[ORGANIZATION].id;

    return {
      roles: token[USER_ROLES].join(","),
      sessionClaims,
      selfcareId,
    };
  };

  const assertTenantAllowed = (selfcareId: string, origin: string): void => {
    if (
      !config.tenantAllowedOrigins.includes(origin) &&
      !allowList.includes(selfcareId)
    ) {
      throw tenantLoginNotAllowed(selfcareId);
    }
  };

  const buildJwtCustomClaims = (
    roles: string,
    tenantId: string,
    selfcareId: string,
    tenantOrigin: string,
    tenantExternalId: string
  ): CustomClaims => ({
    [USER_ROLES]: roles,
    [ORGANIZATION_ID_CLAIM]: tenantId,
    [SELFCARE_ID_CLAIM]: selfcareId,
    [ORGANIZATION_EXTERNAL_ID_CLAIM]: {
      [ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM]: tenantOrigin,
      [ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM]: tenantExternalId,
    },
  });

  return {
    getSessionToken: async (
      correlationId: string,
      identityToken: string,
      logger: Logger
    ): Promise<GetSessionTokenReturnType> => {
      logger.info("Received session token exchange request");

      const { sessionClaims, roles, selfcareId } = await readJwt(
        identityToken,
        logger
      );

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const headers = {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer ${serialized}`,
      };

      const tenantBySelfcareId =
        await tenantProcessClient.selfcare.getTenantBySelfcareId({
          params: { selfcareId },
          headers,
        });
      const tenantId = unsafeBrandId<TenantId>(tenantBySelfcareId.id);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      assertTenantAllowed(selfcareId, tenant.externalId.origin);

      const { limitReached, ...rateLimiterStatus } =
        await rateLimiter.rateLimitByOrganization(tenantId, logger);

      if (limitReached) {
        return {
          limitReached: true,
          sessionToken: undefined,
          rateLimitedTenantId: tenantId,
          rateLimiterStatus,
        };
      }

      const customClaims = buildJwtCustomClaims(
        roles,
        tenantId,
        selfcareId,
        tenant.externalId.origin,
        tenant.externalId.value
      );

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken({
          ...sessionClaims,
          ...customClaims,
        });

      return {
        limitReached: false,
        sessionToken,
        rateLimiterStatus,
      };
    },
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
