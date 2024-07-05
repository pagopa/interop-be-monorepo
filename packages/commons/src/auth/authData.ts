import {
  TenantId,
  UserId,
  unsafeBrandId,
  SelfcareId,
} from "pagopa-interop-models";
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
  MAINTENANCE_ROLE: "maintenance",
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
    "user-roles": CommaSeparatedStringToArray(UIUserRole),
    uid: z.string().uuid(),
    organizationId: z.string().uuid(),
    selfcareId: z.string().uuid(),
    organization: z.object({
      id: z.string().uuid(),
      name: z.string(),
      roles: z.array(
        z.object({
          partyRole: z.string().nullish(),
          role: UIUserRole,
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

  To avoid the need to handle optional fields, we make them required in
  the type definition, but know that they will be set to empty strings or
  empty arrays in case they are not present in the token.

  A possible improvement for this is tracked in: https://pagopa.atlassian.net/browse/IMN-371
*/
export const AuthData = z.object({
  organizationId: TenantId,
  userId: UserId,
  userRoles: z.array(UserRole),
  selfcareId: SelfcareId,
  externalId: z.object({
    value: z.string(),
    origin: z.string(),
  }),
});
export type AuthData = z.infer<typeof AuthData>;
export const defaultAuthData: AuthData = {
  organizationId: unsafeBrandId<TenantId>(""),
  userId: unsafeBrandId<UserId>(""),
  selfcareId: unsafeBrandId<SelfcareId>(""),
  userRoles: [],
  externalId: { value: "", origin: "" },
};

const getUserRoles = (token: AuthToken): UserRole[] =>
  match(token)
    .with({ role: "m2m" }, (t) => [t.role])
    .with({ role: "internal" }, (t) => [t.role])
    .with({ role: "maintenance" }, (t) => [t.role])
    .with({ "user-roles": P.not(P.nullish) }, (t) => t["user-roles"])
    .exhaustive();

const getOrganizationId = (token: AuthToken): TenantId | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, { role: "m2m" }, (t) =>
      unsafeBrandId<TenantId>(t.organizationId)
    )
    .with({ role: "internal" }, { role: "maintenance" }, () => undefined)
    .exhaustive();

const getUserId = (token: AuthToken): UserId | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, (t) =>
      unsafeBrandId<UserId>(t.uid)
    )
    .with(
      { role: "m2m" },
      { role: "internal" },
      { role: "maintenance" },
      () => undefined
    )
    .exhaustive();

const getExternalId = (
  token: AuthToken
): { value: string; origin: string } | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, (t) => t.externalId)
    .with(
      { role: "m2m" },
      { role: "internal" },
      { role: "maintenance" },
      () => undefined
    )
    .exhaustive();

const getSelfcareId = (token: AuthToken): SelfcareId | undefined =>
  match(token)
    .with({ "user-roles": P.not(P.nullish) }, (t) =>
      unsafeBrandId<SelfcareId>(t.selfcareId)
    )
    .with(
      { role: "m2m" },
      { role: "internal" },
      { role: "maintenance" },
      () => undefined
    )
    .exhaustive();

export const getAuthDataFromToken = (token: AuthToken): AuthData => ({
  organizationId: getOrganizationId(token) ?? defaultAuthData.organizationId,
  userId: getUserId(token) ?? defaultAuthData.userId,
  userRoles: getUserRoles(token),
  externalId: getExternalId(token) ?? defaultAuthData.externalId,
  selfcareId: getSelfcareId(token) ?? defaultAuthData.selfcareId,
});
