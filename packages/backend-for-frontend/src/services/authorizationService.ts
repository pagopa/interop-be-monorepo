import { constants } from "http2";
import { bffApi, tenantApi } from "pagopa-interop-api-clients";
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
  userRole,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { TenantId, invalidClaim, unsafeBrandId } from "pagopa-interop-models";
import { isAxiosError } from "axios";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import {
  missingSelfcareId,
  missingUserRolesInIdentityToken,
  tenantLoginNotAllowed,
  tenantBySelfcareIdNotFound,
} from "../model/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { validateSamlResponse } from "../utilities/samlValidator.js";

const SUPPORT_USER_ID = "5119b1fa-825a-4297-8c9c-152e055cabca";
const { HTTP_STATUS_NOT_FOUND } = constants;

type GetSessionTokenReturnType =
  | {
      limitReached: true;
      sessionToken: undefined;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    }
  | {
      limitReached: false;
      sessionToken: bffApi.SessionToken;
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
    const { decoded } = await verifyJwtToken(identityToken, config, logger);

    const { data: sessionClaims, error } = SessionClaims.safeParse(decoded);

    if (error) {
      throw invalidClaim(error);
    }

    const userRoles: string[] = sessionClaims.organization.roles.map(
      (r: { role: string }) => r.role
    );

    if (userRoles.length === 0) {
      throw missingUserRolesInIdentityToken();
    }

    return {
      roles: userRoles.join(","),
      sessionClaims,
      selfcareId: sessionClaims.organization.id,
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

  const retrieveTenantById = async (
    selfcareId: string,
    headers: Headers
  ): Promise<tenantApi.Tenant> => {
    const tenant = await tenantProcessClient.selfcare
      .getTenantBySelfcareId({
        params: { selfcareId },
        headers,
      })
      .catch((err) => {
        throw isAxiosError(err) &&
          err.response?.status === HTTP_STATUS_NOT_FOUND
          ? tenantBySelfcareIdNotFound(selfcareId)
          : err;
      });

    if (!tenant) {
      throw tenantBySelfcareIdNotFound(selfcareId);
    }
    return tenant;
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
          role: userRole.SUPPORT_ROLE,
        },
      ],
    };

    const selfcareClaims = {
      [ORGANIZATION]: organization,
      [UID]: SUPPORT_USER_ID,
    };

    return {
      ...buildJwtCustomClaims(
        userRole.SUPPORT_ROLE,
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

      const tenantBySelfcareId = await retrieveTenantById(selfcareId, {
        ...headers,
        Authorization: `Bearer ${serialized}`,
      });
      const tenantId = unsafeBrandId<TenantId>(tenantBySelfcareId.id);

      assertTenantAllowed(selfcareId, tenantBySelfcareId.externalId.origin);

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
        tenantBySelfcareId.externalId.origin,
        tenantBySelfcareId.externalId.value
      );

      const { serialized: sessionToken } =
        await interopTokenGenerator.generateSessionToken({
          ...sessionClaims,
          ...customClaims,
        });

      return {
        limitReached: false,
        sessionToken: { session_token: sessionToken },
        rateLimiterStatus,
      };
    },
    samlLoginCallback: async (
      samlResponse: string,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<string> => {
      logger.info("Calling Support SAML");

      const decodedSaml = Buffer.from(samlResponse, "base64").toString();
      validateSamlResponse(decodedSaml);

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
      { tenantId, saml2 }: bffApi.SAMLTokenRequest,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.SessionToken> => {
      logger.info("Calling get SAML2 token");

      const decodedSaml = Buffer.from(saml2, "base64").toString();
      validateSamlResponse(decodedSaml);

      const tenant = await tenantProcessClient.tenant.getTenant({
        params: { id: tenantId },
        headers,
      });

      const { serialized: session_token } =
        await interopTokenGenerator.generateSessionToken(
          retrieveSupportClaims(tenant),
          config.supportJwtDuration
        );

      return { session_token };
    },
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
