import {
  TenantId,
  UserId,
  unsafeBrandId,
  SelfcareId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";

export const userRole = {
  ADMIN_ROLE: "admin",
  SECURITY_ROLE: "security",
  API_ROLE: "api",
  SUPPORT_ROLE: "support",
} as const;

export const UserRole = z.enum([
  Object.values(userRole)[0],
  ...Object.values(userRole).slice(1),
]);
export type UserRole = z.infer<typeof UserRole>;

// System roles = special non-UI tokens
export const systemRole = {
  M2M_ROLE: "m2m",
  M2M_ADMIN_ROLE: "m2m-admin",
  INTERNAL_ROLE: "internal",
  MAINTENANCE_ROLE: "maintenance",
} as const;

export const SystemRole = z.enum([
  Object.values(systemRole)[0],
  ...Object.values(systemRole).slice(1),
]);
export type SystemRole = z.infer<typeof SystemRole>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const CommaSeparatedStringToArray = <T extends z.ZodType>(t: T) =>
  z
    .string()
    .nonempty()
    .transform((s: string) => s.split(","))
    .pipe(z.array(t));

const SharedStandardJWTClaims = z.object({
  // All standard claims except "sub", which is not present in UI tokens
  iss: z.string(),
  aud: z.union([z.array(z.string()), CommaSeparatedStringToArray(z.string())]),
  exp: z.number(),
  nbf: z.number(),
  iat: z.number(),
  jti: z.string(),
});

const M2MAuthTokenCommonProps = SharedStandardJWTClaims.merge(
  z.object({
    organizationId: z.string().uuid(),
    client_id: z.string().uuid(),
    sub: z.string(),
  })
);

export const M2MAuthToken = M2MAuthTokenCommonProps.merge(
  z.object({
    role: z.literal(systemRole.M2M_ROLE),
  })
);

export const M2MAdminAuthToken = M2MAuthTokenCommonProps.merge(
  z.object({
    role: z.literal(systemRole.M2M_ADMIN_ROLE),
    userId: z.string().uuid(),
    // ^ ID of the admin user associated with the client
  })
);

export const InternalAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal(systemRole.INTERNAL_ROLE),
    sub: z.string(),
  })
);

export const MaintenanceAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal(systemRole.MAINTENANCE_ROLE),
    sub: z.string(),
  })
);

export const UIAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    // setting role to z.undefined() to make the discriminated union work.
    // z.discriminatedUnion performs better than z.union and gives more meaningful parsing errors.
    role: z.undefined(),
    "user-roles": CommaSeparatedStringToArray(UserRole),
    uid: z.string().uuid(),
    organizationId: z.string().uuid(),
    selfcareId: z.string().uuid(),
    organization: z.object({
      id: z.string().uuid(),
      name: z.string(),
      roles: z.array(
        z.object({
          partyRole: z.string().nullish(),
          role: UserRole,
        })
      ),
      fiscal_code: z.string().nullish(),
      ipaCode: z.string().nullish(),
    }),
    externalId: z.object({
      origin: z.string(),
      value: z.string(),
    }),
    name: z.string().nullish(),
    family_name: z.string().nullish(),
    email: z.string().nullish(),
  })
);

export const AuthToken = z.discriminatedUnion("role", [
  M2MAuthToken,
  M2MAdminAuthToken,
  InternalAuthToken,
  MaintenanceAuthToken,
  UIAuthToken,
]);
export type AuthToken = z.infer<typeof AuthToken>;

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
};

export type M2MAdminAuthData = {
  systemRole: Extract<SystemRole, "m2m-admin">;
  organizationId: TenantId;
  userId: UserId;
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

export const getAuthDataFromToken = (token: AuthToken): AuthData =>
  match<AuthToken, AuthData>(token)
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
    }))
    .with({ role: systemRole.M2M_ADMIN_ROLE }, (t) => ({
      systemRole: t.role,
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userId: unsafeBrandId<UserId>(t.userId),
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
