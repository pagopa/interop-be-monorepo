import { tenantApi } from "pagopa-interop-api-clients";
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
  UID,
  decodeJwtToken,
  userRoles,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { genericError } from "pagopa-interop-models";
import { config } from "../config/config.js";
import { genericError, TenantId, unsafeBrandId } from "pagopa-interop-models";
import {
  missingClaim,
  tenantLoginNotAllowed,
  tokenVerificationFailed,
  missingSelfcareId,
} from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { validateSamlResponse } from "../utilities/samlValidator.js";

const SUPPORT_USER_ID = "5119b1fa-825a-4297-8c9c-152e055cabca";

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

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const buildSupportClaims = (selfcareId: string, tenant: tenantApi.Tenant) => {
    const organization = {
      id: selfcareId,
      name: tenant.name,
      roles: [
        {
          role: userRoles.SUPPORT_ROLE,
        },
      ],
    };

    const selfcareClaims = {
      [ORGANIZATION]: organization,
      [UID]: SUPPORT_USER_ID,
    };

    return {
      ...buildJwtCustomClaims(
        userRoles.SUPPORT_ROLE,
        tenant.id,
        selfcareId,
        tenant.externalId.origin,
        tenant.externalId.value
      ),
      ...selfcareClaims,
    };
  };

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
    samlLoginCallback: async (
      correlationId: string,
      samlResponse: string
    ): Promise<string> => {
      validateSamlResponse(samlResponse);

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const headers = {
        "X-Correlation-Id": correlationId,
        Authorization: `Bearer ${serialized}`,
      };

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: config.pagoPaTenantId },
        headers,
      });

      const selfcareId = tenant.selfcareId;
      if (!selfcareId) {
        throw missingSelfcareId(config.pagoPaTenantId);
      }

      const claims = buildSupportClaims(selfcareId, tenant);

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken(
          claims,
          config.supportLandingJwtDuration
        );

      return sessionToken;
    },
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
