import {
  SelfcareId,
  TenantId,
  UserId,
  ClientId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  AuthTokenDPoPPayload,
  AuthTokenPayload,
} from "../interop-token/models.js";
import { SystemRole, UserRole, systemRole } from "./roles.js";

/* NOTE:
  The following type represents the data extracted from the JWT token.
  It is used to populate the context object, which is referenced all
  around the application to perform authorization checks.
*/

export type UIAuthData = {
  systemRole: undefined;
  organizationId: TenantId;
  userId: UserId;
  userRoles: UserRole[];
  selfcareId: SelfcareId;
  jti: string;
  externalId: {
    value: string;
    origin: string;
  };
};

export type M2MAuthData = {
  systemRole: Extract<SystemRole, "m2m">;
  organizationId: TenantId;
  clientId: ClientId;
  jti: string;
};

// Adding M2MDPoPAuthData
export type M2MDPoPAuthData = {
  systemRole: Extract<SystemRole, "m2m">;
  organizationId: TenantId;
  clientId: ClientId;
  jti: string;
  cnf: {
    jkt: string;
  };
};

// Adding M2MDPoPAuthData
export type M2MAdminAuthData = {
  systemRole: Extract<SystemRole, "m2m-admin">;
  organizationId: TenantId;
  userId: UserId;
  clientId: ClientId;
  jti: string;
};

export type M2MDPoPAdminAuthData = {
  systemRole: Extract<SystemRole, "m2m-admin">;
  organizationId: TenantId;
  userId: UserId;
  clientId: ClientId;
  jti: string;
  cnf: {
    jkt: string;
  };
};

export type InternalAuthData = {
  systemRole: Extract<SystemRole, "internal">;
  jti: string;
};

export type MaintenanceAuthData = {
  systemRole: Extract<SystemRole, "maintenance">;
  jti: string;
};

// Adding M2MDPoPAuthData, M2MADPoPAdminAuthData
export type AuthData =
  | UIAuthData
  | M2MAuthData
  | M2MAdminAuthData
  | M2MDPoPAuthData
  | M2MDPoPAdminAuthData
  | InternalAuthData
  | MaintenanceAuthData;

export type DPoPAuthData = M2MDPoPAuthData | M2MDPoPAdminAuthData;

export const getAuthDataFromToken = (token: AuthTokenPayload): AuthData =>
  match<AuthTokenPayload, AuthData>(token)
    .with(
      { role: systemRole.INTERNAL_ROLE },
      { role: systemRole.MAINTENANCE_ROLE },
      (t) => ({
        systemRole: t.role,
        jti: t.jti,
      })
    )
    .with({ role: systemRole.M2M_ROLE }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      jti: t.jti,
    }))
    .with({ role: systemRole.M2M_ADMIN_ROLE }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      userId: unsafeBrandId<UserId>(t.adminId),
      jti: t.jti,
    }))
    .with({ "user-roles": P.not(P.nullish) }, (t) => ({
      systemRole: undefined,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userId: unsafeBrandId<UserId>(t.uid),
      userRoles: t["user-roles"],
      selfcareId: unsafeBrandId<SelfcareId>(t.selfcareId),
      externalId: t.externalId,
      jti: t.jti,
    }))
    .exhaustive();

export const getAuthDataFromDPoPToken = (
  token: AuthTokenDPoPPayload
): DPoPAuthData =>
  match<AuthTokenDPoPPayload, DPoPAuthData>(token)
    .with({ role: systemRole.M2M_ROLE, cnf: P.not(P.nullish) }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      jti: t.jti,
      cnf: t.cnf,
    }))
    .with({ role: systemRole.M2M_ADMIN_ROLE, cnf: P.not(P.nullish) }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      userId: unsafeBrandId<UserId>(t.adminId),
      jti: t.jti,
      cnf: t.cnf,
    }))
    .exhaustive();

export type AuthDataUserInfo = {
  userId: UserId | undefined;
  organizationId: TenantId | undefined;
  selfcareId: SelfcareId | undefined;
};
export function getUserInfoFromAuthData(
  authData: AuthData | DPoPAuthData | undefined | null
): AuthDataUserInfo {
  if (!authData) {
    return {
      userId: undefined,
      organizationId: undefined,
      selfcareId: undefined,
    };
  }

  return match<AuthData | DPoPAuthData, AuthDataUserInfo>(authData)
    .with(
      {
        systemRole: P.union(
          systemRole.INTERNAL_ROLE,
          systemRole.MAINTENANCE_ROLE
        ),
      },
      () => ({
        userId: undefined,
        organizationId: undefined,
        selfcareId: undefined,
      })
    )
    .with({ systemRole: systemRole.M2M_ROLE }, (t) => ({
      userId: undefined,
      organizationId: t.organizationId,
      selfcareId: undefined,
    }))
    .with({ systemRole: systemRole.M2M_ADMIN_ROLE }, (t) => ({
      userId: t.userId,
      organizationId: t.organizationId,
      selfcareId: undefined,
    }))
    .with({ systemRole: undefined }, (t) => ({
      userId: t.userId,
      organizationId: t.organizationId,
      selfcareId: t.selfcareId,
    }))
    .exhaustive();
}
