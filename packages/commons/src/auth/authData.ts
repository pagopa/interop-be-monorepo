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

export type M2MDPoPAuthData = M2MAuthData & {
  cnf: { jkt: string };
};

export type M2MAdminAuthData = {
  systemRole: Extract<SystemRole, "m2m-admin">;
  organizationId: TenantId;
  userId: UserId;
  clientId: ClientId;
  jti: string;
};

export type M2MAdminDPoPAuthData = M2MAdminAuthData & {
  cnf: { jkt: string };
};

export type InternalAuthData = {
  systemRole: Extract<SystemRole, "internal">;
  jti: string;
};

export type MaintenanceAuthData = {
  systemRole: Extract<SystemRole, "maintenance">;
  jti: string;
};

export type AuthData =
  | UIAuthData
  | M2MAuthData
  | M2MDPoPAuthData
  | M2MAdminAuthData
  | M2MAdminDPoPAuthData
  | InternalAuthData
  | MaintenanceAuthData;

export const getAuthDataFromToken = (
  token: AuthTokenPayload | AuthTokenDPoPPayload
): AuthData =>
  match<AuthTokenPayload | AuthTokenDPoPPayload, AuthData>(token)
    // --- Other roles (Internal, UI, Maintenance) do not have DPoP variants --
    .with(
      { role: systemRole.INTERNAL_ROLE },
      { role: systemRole.MAINTENANCE_ROLE },
      (t) => ({
        systemRole: t.role,
        jti: t.jti,
      })
    )
    // --- M2M DPoP Case (cnf present) ---
    // will narrow the type to AuthTokenDPoPPayload in this branch
    .with({ role: systemRole.M2M_ROLE, cnf: P.not(P.nullish) }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      jti: t.jti,
      cnf: t.cnf,
    }))
    // --- M2M Standard Case ---
    .with({ role: systemRole.M2M_ROLE }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      jti: t.jti,
    }))
    // --- M2M Admin DPoP Case (cnf presente) ---
    // will narrow the type to InteropJwtApiM2MAdminDPoPPayload in this branch
    .with({ role: systemRole.M2M_ADMIN_ROLE, cnf: P.not(P.nullish) }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      userId: unsafeBrandId<UserId>(t.adminId),
      jti: t.jti,
      cnf: t.cnf,
    }))
    // --- M2M Admin Standard Case ---
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

export type AuthDataUserInfo = {
  userId: UserId | undefined;
  organizationId: TenantId | undefined;
  selfcareId: SelfcareId | undefined;
};
export function getUserInfoFromAuthData(
  authData: AuthData | undefined | null
): AuthDataUserInfo {
  if (!authData) {
    return {
      userId: undefined,
      organizationId: undefined,
      selfcareId: undefined,
    };
  }

  return (
    match<AuthData, AuthDataUserInfo>(authData)
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
      // Here systemRole.M2M_ROLE captures both M2MAuthData and M2MDPoPAuthData
      .with({ systemRole: systemRole.M2M_ROLE }, (t) => ({
        userId: undefined,
        organizationId: t.organizationId,
        selfcareId: undefined,
      }))
      // Here systemRole.M2M_ADMIN_ROLE captures both M2MAdminAuthData and M2MAdminDPoPAuthData
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
      .exhaustive()
  );
}
