import { TenantId, unsafeBrandId } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { z } from "zod";

const uiTokenUserRoles = {
  ADMIN_ROLE: "admin",
  SECURITY_ROLE: "security",
  API_ROLE: "api",
  SUPPORT_ROLE: "support",
} as const;

const UIUserRole = z.enum([
  Object.values(uiTokenUserRoles)[0],
  ...Object.values(uiTokenUserRoles).slice(1),
]);

export const userRoles = {
  ...uiTokenUserRoles,
  M2M_ROLE: "m2m",
  INTERNAL_ROLE: "internal",
} as const;

export const UserRole = z.enum([
  Object.values(userRoles)[0],
  ...Object.values(userRoles).slice(1),
]);
export type UserRole = z.infer<typeof UserRole>;

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
  aud: CommaSeparatedStringToArray(z.string()),
  exp: z.number(),
  nbf: z.number(),
  iat: z.number(),
  jti: z.string().uuid(),
});

export const M2MAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal("m2m"),
    organizationId: z.string().uuid(),
    client_id: z.string().uuid(),
    sub: z.string().uuid(),
  })
);

export const InternalAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    role: z.literal("internal"),
    sub: z.string().uuid(),
  })
);

export const UIAuthToken = SharedStandardJWTClaims.merge(
  z.object({
    // setting role to z.undefined() to make the discriminated union work.
    // z.discriminatedUnion performs better than z.union and gives more meaningful parsing errors.
    role: z.undefined(),
    "user-roles": CommaSeparatedStringToArray(UIUserRole),
    uid: z.string().uuid(),
    organizationId: z.string().uuid(),
    selfcareId: z.string().uuid(),
    organization: z.object({
      id: z.string().uuid(),
      name: z.string(),
      roles: z.array(
        z.object({
          partyRole: z.string(),
          role: UIUserRole,
        })
      ),
      fiscal_code: z.string().optional(),
      ipaCode: z.string().optional(),
    }),
    externalId: z.object({
      origin: z.string(),
      value: z.string(),
    }),
    name: z.string(),
    family_name: z.string(),
    email: z.string(),
  })
);

export const AuthToken = z.discriminatedUnion("role", [
  M2MAuthToken,
  InternalAuthToken,
  UIAuthToken,
]);
export type AuthToken = z.infer<typeof AuthToken>;

export const EmptyAuthData = z.object({
  tokenType: z.literal("empty"),
});
export type EmptyAuthData = z.infer<typeof EmptyAuthData>;

export const AuthDataM2M = z.object({
  tokenType: z.literal("m2m"),
  organizationId: TenantId,
});
export type AuthDataM2M = z.infer<typeof AuthDataM2M>;

export const AuthDataInternal = z.object({
  tokenType: z.literal("internal"),
});
export type AuthDataInternal = z.infer<typeof AuthDataInternal>;

export const AuthDataUI = z.object({
  tokenType: z.literal("ui"),
  userRoles: z.array(UIUserRole),
  organizationId: TenantId,
  userId: z.string().uuid(),
  externalId: z.object({
    value: z.string(),
    origin: z.string(),
  }),
});
export type AuthDataUI = z.infer<typeof AuthDataUI>;

export const AuthData = z.discriminatedUnion("tokenType", [
  EmptyAuthData,
  AuthDataM2M,
  AuthDataInternal,
  AuthDataUI,
]);
export type AuthData = z.infer<typeof AuthData>;

export function getAuthDataFromToken(token: AuthToken): AuthData {
  return match<AuthToken, AuthData>(token)
    .with({ role: "m2m" }, (t) => ({
      tokenType: "m2m",
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
    }))
    .with({ role: "internal" }, () => ({
      tokenType: "internal",
    }))
    .with({ "user-roles": P.not(P.nullish) }, (t) => ({
      tokenType: "ui",
      userRoles: t["user-roles"],
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userId: t.uid,
      externalId: t.externalId,
    }))
    .exhaustive();
}

export function getUserRolesFromAuthData(authData: AuthData): UserRole[] {
  return match<AuthData, UserRole[]>(authData)
    .with({ tokenType: "empty" }, () => [])
    .with({ tokenType: "internal" }, () => ["internal"])
    .with({ tokenType: "m2m" }, () => ["m2m"])
    .with({ tokenType: "ui" }, (d) => d.userRoles)
    .exhaustive();
}
