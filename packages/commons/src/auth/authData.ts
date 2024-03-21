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

const EmptyAuthData = z.object({
  type: z.literal("empty"),
});

const AuthDataM2M = z.object({
  type: z.literal("m2m"),
  organizationId: TenantId,
  userRoles: z.array(z.literal("m2m")),
});

const AuthDataInternal = z.object({
  type: z.literal("internal"),
  userRoles: z.array(z.literal("internal")),
});

const AuthDataUI = z.object({
  type: z.literal("ui"),
  organizationId: TenantId,
  userId: z.string().uuid(),
  userRoles: z.array(UserRole),
  externalId: z.object({
    value: z.string(),
    origin: z.string(),
  }),
});

export const AuthData = z.discriminatedUnion("type", [
  EmptyAuthData,
  AuthDataM2M,
  AuthDataInternal,
  AuthDataUI,
]);
export type AuthData = z.infer<typeof AuthData>;

export function getAuthDataFromToken(token: AuthToken): AuthData {
  return match<AuthToken, AuthData>(token)
    .with({ role: "m2m" }, (t) => ({
      type: "m2m",
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userRoles: [t.role],
    }))
    .with({ role: "internal" }, (t) => ({
      type: "internal",
      userRoles: [t.role],
    }))
    .with({ "user-roles": P.not(P.nullish) }, (t) => ({
      type: "ui",
      organizationId: unsafeBrandId<TenantId>(t.organizationId),
      userId: t.uid,
      userRoles: t["user-roles"],
      externalId: t.externalId,
    }))
    .exhaustive();
}
