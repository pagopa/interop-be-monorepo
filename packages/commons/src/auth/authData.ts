import {
  SelfcareId,
  TenantId,
  UserId,
  ClientId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { AuthTokenPayload } from "../interop-token/models.js";
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
  externalId: {
    value: string;
    origin: string;
  };
};

export type M2MAuthData = {
  systemRole: Extract<SystemRole, "m2m">;
  organizationId: TenantId;
  clientId: ClientId;
};

export type M2MAdminAuthData = {
  systemRole: Extract<SystemRole, "m2m-admin">;
  organizationId: TenantId;
  userId: UserId;
  clientId: ClientId;
};

export type InternalAuthData = {
  systemRole: Extract<SystemRole, "internal">;
};

export type MaintenanceAuthData = {
  systemRole: Extract<SystemRole, "maintenance">;
};

export type AuthData =
  | UIAuthData
  | M2MAuthData
  | M2MAdminAuthData
  | InternalAuthData
  | MaintenanceAuthData;

export const getAuthDataFromToken = (token: AuthTokenPayload): AuthData =>
  match<AuthTokenPayload, AuthData>(token)
    .with(
      { role: systemRole.INTERNAL_ROLE },
      { role: systemRole.MAINTENANCE_ROLE },
      (t) => ({
        systemRole: t.role,
      })
    )
    .with({ role: systemRole.M2M_ROLE }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
    }))
    .with({ role: systemRole.M2M_ADMIN_ROLE }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      clientId: unsafeBrandId<ClientId>(t.client_id),
      userId: unsafeBrandId<UserId>(t.adminId),
    }))
    .with({ "user-roles": P.not(P.nullish) }, (t) => ({
      systemRole: undefined,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userId: unsafeBrandId<UserId>(t.uid),
      userRoles: t["user-roles"],
      selfcareId: unsafeBrandId<SelfcareId>(t.selfcareId),
      externalId: t.externalId,
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

  return match<AuthData, AuthDataUserInfo>(authData)
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
