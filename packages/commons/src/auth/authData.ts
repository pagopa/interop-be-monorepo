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
const CommaSeparatedStringsToArray = <T extends z.ZodType>(t: T) =>
  z.preprocess((s: unknown) => String(s).split(","), z.array(t));

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const JWTArray = <T extends z.ZodType>(t: T) =>
  z.union([CommaSeparatedStringsToArray(t), z.array(t)]);

const StandardJWTClaims = z.object({
  iss: z.string(),
  sub: z.string().uuid(),
  aud: JWTArray(z.string()),
  exp: z.number(),
  nbf: z.number(),
  iat: z.number(),
  jti: z.string().uuid(),
});

export const M2MAuthToken = z
  .object({
    role: z.literal("m2m"),
    organizationId: z.string().uuid(),
    client_id: z.string().uuid(),
  })
  .and(StandardJWTClaims);

export const InternalAuthToken = z
  .object({
    role: z.literal("internal"),
  })
  .and(StandardJWTClaims);

export const UIAuthToken = z
  .object({
    "user-roles": JWTArray(UIUserRole),
    uid: z.string().uuid(),
    organizationId: z.string().uuid(),
    selfcareId: z.string().uuid(),
    name: z.string(),
    family_name: z.string(),
    email: z.string(),
    organization: z.object({
      id: z.string().uuid(),
      name: z.string(),
      roles: z.array(
        z.object({
          partyRole: z.string(),
          role: UIUserRole,
        })
      ),
      fiscal_code: z.string(),
      ipaCode: z.string(),
    }),
    externalId: z.object({
      origin: z.string(),
      value: z.string(),
    }),
  })
  .and(StandardJWTClaims);

export const AuthToken = z.union([
  M2MAuthToken,
  InternalAuthToken,
  UIAuthToken,
]);
export type AuthToken = z.infer<typeof AuthToken>;

/* NOTE:
  The following type represents the data extracted from the JWT token.
  It is used to populate the context object, which is referenced all
  around the application to perform authorization checks.

  To avoid the need to handle optional fields, we make them required in
  the type definition, and set default values to be used when the field
  is not present in the token.
*/
export const AuthData = z.object({
  organizationId: TenantId.default(""),
  userId: z.string().uuid().default(""),
  userRoles: z.array(UserRole).default([]),
  externalId: z
    .object({
      origin: z.string(),
      value: z.string(),
    })
    .default({ origin: "", value: "" }),
});
export type AuthData = z.infer<typeof AuthData>;
export const defaultAuthData: AuthData = AuthData.parse({});

const getUserRoles = (token: AuthToken): UserRole[] =>
  match(token)
    .with({ role: "m2m" }, (t) => [t.role])
    .with({ role: "internal" }, (t) => [t.role])
    .with({ "user-roles": P.not(P.nullish) }, (t) => t["user-roles"])
    .exhaustive();

const getOrganizationId = (token: AuthToken): TenantId | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, { role: "m2m" }, (t) =>
      unsafeBrandId<TenantId>(t.organizationId)
    )
    .with({ role: "internal" }, () => undefined)
    .exhaustive();

const getUserId = (token: AuthToken): string | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, (t) => t.uid)
    .with({ role: "m2m" }, { role: "internal" }, () => undefined)
    .exhaustive();

const getExternalId = (
  token: AuthToken
): { value: string; origin: string } | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, (t) => t.externalId)
    .with({ role: "m2m" }, { role: "internal" }, () => undefined)
    .exhaustive();

export const getAuthDataFromToken = (token: AuthToken): AuthData =>
  AuthData.parse({
    organizationId: getOrganizationId(token),
    userId: getUserId(token),
    userRoles: getUserRoles(token),
    externalId: getExternalId(token),
  });
