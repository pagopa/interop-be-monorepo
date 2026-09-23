import { isAxiosError } from "axios";
import { constants } from "http2";
import { bffApi, tenantApi } from "pagopa-interop-api-clients";
import {
  InteropTokenGenerator,
  Logger,
  RateLimiter,
  RateLimiterStatus,
  SessionClaims,
  UserClaims,
  UserRole,
  WithLogger,
  verifyJwtToken,
} from "pagopa-interop-commons";
import {
  SelfcareId,
  TenantId,
  invalidClaim,
  unsafeBrandId,
} from "pagopa-interop-models";

import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { config } from "../config/config.js";
import {
  missingUserRolesInIdentityToken,
  tenantLoginNotAllowed,
  tenantBySelfcareIdNotFound,
} from "../model/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";

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
  };
}
export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
