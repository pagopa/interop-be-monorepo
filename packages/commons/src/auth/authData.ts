import {
  TenantId,
  UserId,
  unsafeBrandId,
  SelfcareId,
  unauthorizedError,
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const CommaSeparatedStringToArray = <T extends z.ZodType>(t: T) =>
  z
    .string()
    .transform((s: string) => s.split(","))
    .pipe(z.array(t).nonempty());

const SharedStandardJWTClaims = z.object({
  // All standard claims except "sub", which is not present in UI tokens
  iss: z.string(),
  aud: z.union([z.array(z.string()), CommaSeparatedStringToArray(z.string())]),
  exp: z.number(),
  nbf: z.number(),
  iat: z.number(),
  jti: z.string(),
});

export const M2MAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal("m2m"),
    organizationId: z.string().uuid(),
    client_id: z.string().uuid(),
    sub: z.string(),
  })
);

export const InternalAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal("internal"),
    sub: z.string(),
  })
);

export const MaintenanceAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal("maintenance"),
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
  tokenType: "ui";
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
  tokenType: "m2m";
  organizationId: TenantId;
};

export type InternalAuthData = {
  tokenType: "internal";
};

export type MaintenanceAuthData = {
  tokenType: "maintenance";
};

export type AuthData =
  | UIAuthData
  | M2MAuthData
  | InternalAuthData
  | MaintenanceAuthData;

export const getAuthDataFromToken = (token: AuthToken): AuthData =>
  match<AuthToken, AuthData>(token)
    .with({ role: "internal" }, () => ({ tokenType: "internal" }))
    .with({ role: "maintenance" }, () => ({ tokenType: "maintenance" }))
    .with({ role: "m2m" }, (t) => ({
      tokenType: "m2m",
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
    }))
    .with({ "user-roles": P.not(P.nullish) }, (t) => ({
      tokenType: "ui",
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userId: unsafeBrandId<UserId>(t.uid),
      userRoles: t["user-roles"],
      selfcareId: unsafeBrandId<SelfcareId>(t.selfcareId),
      externalId: t.externalId,
    }))
    .exhaustive();

export function getUserInfoFromAuthData(authData: AuthData | undefined): {
  userId: UserId | undefined;
  organizationId: TenantId | undefined;
} {
  if (!authData) {
    return { userId: undefined, organizationId: undefined };
  }

  return match<
    AuthData,
    { userId: UserId | undefined; organizationId: TenantId | undefined }
  >(authData)
    .with({ tokenType: "internal" }, { tokenType: "maintenance" }, () => ({
      userId: undefined,
      organizationId: undefined,
    }))
    .with({ tokenType: "m2m" }, (t) => ({
      userId: undefined,
      organizationId: t.organizationId,
    }))
    .with({ tokenType: "ui" }, (t) => ({
      userId: t.userId,
      organizationId: t.organizationId,
    }))
    .exhaustive();
}

export function assertAuthDataTokenTypeIn<T extends AuthData["tokenType"]>(
  authData: AuthData,
  tokenTypes: ReadonlyArray<T>
): asserts authData is Extract<AuthData, { tokenType: T }> {
  if (!tokenTypes.includes(authData.tokenType as T)) {
    throw unauthorizedError(
      `Invalid token type '${authData.tokenType}' to execute this request`
    );
  }
}

export function hasUserRole(
  authData: AuthData,
  userRoles: UserRole[]
): boolean {
  return (
    authData.tokenType === "ui" &&
    authData.userRoles.some((role: UserRole) => userRoles.includes(role))
  );
}
