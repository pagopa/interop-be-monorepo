import { tenantApi } from "pagopa-interop-api-clients";
import {
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
  UID,
  USER_ROLES,
  WithLogger,
  decodeJwtToken,
  userRoles,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { TenantId, genericError, unsafeBrandId } from "pagopa-interop-models";
import { config } from "../config/config.js";
import {
  missingClaim,
  missingSelfcareId,
  tenantLoginNotAllowed,
  tokenVerificationFailed,
} from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { validateSamlResponse } from "../utilities/samlValidator.js";
import { BffAppContext } from "../utilities/context.js";

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

    const userRoles: string[] = decoded?.organization?.roles
      ? decoded.organization.roles.map((r: { role: string }) => r.role)
      : decoded?.[USER_ROLES]
      ? decoded[USER_ROLES].split(",")
      : decoded?.role
      ? decoded.role.split(",")
      : [];

    if (userRoles.length === 0) {
      throw genericError("Unable to extract userRoles from claims");
    }

    const { data: sessionClaims, error } = SessionClaims.safeParse(decoded);
    if (error) {
      const claim = error.errors[0].path.join(".");
      throw missingClaim(claim);
    }

    const selfcareId = sessionClaims[ORGANIZATION].id;

    return {
      roles: userRoles.join(","),
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

  const retrieveSupportClaims = (
    tenant: tenantApi.Tenant
  ): ReturnType<typeof buildSupportClaims> => {
    const selfcareId = tenant.selfcareId;
    if (!selfcareId) {
      throw missingSelfcareId(config.pagoPaTenantId);
    }

    return buildSupportClaims(selfcareId, tenant);
  };

  return {
    getSessionToken: async (
      identityToken: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<GetSessionTokenReturnType> => {
      logger.info("Received session token exchange request");

      const { sessionClaims, roles, selfcareId } = await readJwt(
        identityToken,
        logger
      );

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const internalHeaders = {
        ...headers,
        Authorization: `Bearer ${serialized}`,
      };

      const tenantBySelfcareId =
        await tenantProcessClient.selfcare.getTenantBySelfcareId({
          params: { selfcareId },
          headers: internalHeaders,
        });
      const tenantId = unsafeBrandId<TenantId>(tenantBySelfcareId.id);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers: internalHeaders,
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
      samlResponse: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<string> => {
      logger.info("Calling Support SAML");

      validateSamlResponse(samlResponse);

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: config.pagoPaTenantId },
        headers: {
          ...headers,
          Authorization: `Bearer ${serialized}`,
        },
      });

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken(
          retrieveSupportClaims(tenant),
          config.supportLandingJwtDuration
        );

      return sessionToken;
    },
    getSaml2Token: async (
      samlResponse: string,
      tenantId: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<string> => {
      logger.info("Calling get SAML2 token");

      validateSamlResponse(samlResponse);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken(
          retrieveSupportClaims(tenant),
          config.supportJwtDuration
        );

      return sessionToken;
    },
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
