import { constants } from "http2";
import { bffApi, tenantApi } from "pagopa-interop-api-clients";
import {
  InteropTokenGenerator,
  Logger,
  RateLimiter,
  RateLimiterStatus,
  SUPPORT_USER_ID,
  SessionClaims,
  UIClaims,
  UserClaims,
  UserRole,
  WithLogger,
  userRole,
  verifyJwtToken,
} from "pagopa-interop-commons";
import {
  SelfcareId,
  TenantId,
  invalidClaim,
  unsafeBrandId,
} from "pagopa-interop-models";
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

const { HTTP_STATUS_NOT_FOUND } = constants;

export type GetSessionTokenReturnType =
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
    roles: UserRole[];
    sessionClaims: SessionClaims;
    selfcareId: SelfcareId;
  }> => {
    const { decoded } = await verifyJwtToken(identityToken, config, logger);

    const { data: sessionClaims, error } = SessionClaims.safeParse(decoded);

    if (error) {
      throw invalidClaim(error);
    }

    const userRoles: UserRole[] = sessionClaims.organization.roles.map(
      (r: { role: UserRole }) => r.role
    );

    if (userRoles.length === 0) {
      throw missingUserRolesInIdentityToken();
    }

    return {
      roles: userRoles,
      sessionClaims,
      selfcareId: sessionClaims.organization.id,
    };
  };

  const assertTenantAllowed = (
    selfcareId: SelfcareId,
    origin: string
  ): void => {
    if (
      !config.tenantAllowedOrigins.includes(origin) &&
      !allowList.includes(selfcareId)
    ) {
      throw tenantLoginNotAllowed(selfcareId);
    }
  };

  const buildUserClaims = (
    roles: UserRole[],
    tenantId: TenantId,
    selfcareId: SelfcareId,
    externalId: tenantApi.ExternalId
  ): UserClaims => ({
    "user-roles": roles,
    organizationId: tenantId,
    selfcareId,
    externalId,
  });

  const retrieveTenantBySelfcareId = async (
    selfcareId: string,
    headers: Headers
  ): Promise<tenantApi.Tenant> =>
    tenantProcessClient.selfcare
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

  const retrieveSupportClaims = ({
    selfcareId,
    id,
    name,
    externalId,
  }: tenantApi.Tenant): UIClaims => {
    if (!selfcareId) {
      throw missingSelfcareId(config.pagoPaTenantId);
    }

    return {
      ...buildUserClaims(
        [userRole.SUPPORT_ROLE],
        unsafeBrandId(id),
        unsafeBrandId(selfcareId),
        externalId
      ),
      organization: {
        id: unsafeBrandId(selfcareId),
        name,
        roles: [
          {
            role: userRole.SUPPORT_ROLE,
          },
        ],
      },
      uid: SUPPORT_USER_ID,
    };
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

      const tenantBySelfcareId = await retrieveTenantBySelfcareId(selfcareId, {
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

      const customClaims = buildUserClaims(
        roles,
        tenantId,
        selfcareId,
        tenantBySelfcareId.externalId
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
