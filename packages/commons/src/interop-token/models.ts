import {
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  PurposeId,
  SelfcareId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { z } from "zod";
import { systemRole, UserRole } from "../auth/roles.js";

// Zod utility to parse a non-empty comma-separated string and transform it
// (e.g. `"foo,bar,baz"`) into an array whose elements are validated
// by the schema `t`.
//
// Example:
//   const NumberArray = CommaSeparatedStringToArray(z.number());
//   NumberArray.parse("1,2,3"); // → [1, 2, 3]
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const CommaSeparatedStringToArray = <T extends z.ZodType>(t: T) =>
  z
    .string()
    .nonempty()
    .transform((s: string) => s.split(","))
    .pipe(z.array(t));

export const InteropJwtHeader = z.object({
  alg: z.string(),
  use: z.string(),
  typ: z.string(),
  kid: z.string(),
});
export type InteropJwtHeader = z.infer<typeof InteropJwtHeader>;

export const InteropJwtCommonPayload = z.object({
  // All standard claims except "sub", which is not present in UI tokens
  iss: z.string(),
  aud: z.union([z.array(z.string()), CommaSeparatedStringToArray(z.string())]),
  exp: z.number(),
  nbf: z.number(),
  iat: z.number(),
  jti: z.string(),
});
export type InteropJwtCommonPayload = z.infer<typeof InteropJwtCommonPayload>;

/* ==========================================
    Interop CONSUMER Token
  ========================================== */
const CNF = z.object({
  // jkt is a hash of the public key, required claim for DPoP tokens.
  jkt: z.string(),
});

export const InteropJwtConsumerPayload = InteropJwtCommonPayload.merge(
  z.object({
    client_id: ClientId,
    sub: ClientId,
    purposeId: PurposeId,
    digest: ClientAssertionDigest.optional(),
    // NOTE: The following claims are behind the feature flag
    // FEATURE_FLAG_IMPROVED_PRODUCER_VERIFICATION_CLAIMS.
    // They should become required once the feature flag is removed.
    producerId: TenantId.optional(),
    consumerId: TenantId.optional(),
    eserviceId: EServiceId.optional(),
    descriptorId: DescriptorId.optional(),
    // Only for DPoP tokens
    cnf: CNF.optional(),
  })
);
export type InteropJwtConsumerPayload = z.infer<
  typeof InteropJwtConsumerPayload
>;

export type InteropConsumerToken = {
  header: InteropJwtHeader;
  payload: InteropJwtConsumerPayload;
  serialized: string;
};

// ==========================================
//     Interop API Tokens
// ==========================================
export const InteropJwtApiCommonPayload = InteropJwtCommonPayload.merge(
  z.object({
    client_id: ClientId,
    sub: ClientId,
    organizationId: TenantId,
    cnf: CNF.optional(),
  })
);
export type InteropJwtApiCommonPayload = z.infer<
  typeof InteropJwtApiCommonPayload
>;

export const InteropJwtApiM2MPayload = InteropJwtApiCommonPayload.merge(
  z.object({ role: z.literal(systemRole.M2M_ROLE) })
);
export type InteropJwtApiM2MPayload = z.infer<typeof InteropJwtApiM2MPayload>;

export const InteropJwtApiM2MAdminPayload = InteropJwtApiCommonPayload.merge(
  z.object({
    role: z.literal(systemRole.M2M_ADMIN_ROLE),
    adminId: UserId,
    // ^ ID of the admin user associated with the client
  })
);
export type InteropJwtApiM2MAdminPayload = z.infer<
  typeof InteropJwtApiM2MAdminPayload
>;

// Adding InteropJwtApiM2MDPoPPayload, InteropJwtApiM2MAdminDPoPPayload
export type InteropJwtApiPayload =
  | InteropJwtApiM2MAdminPayload
  | InteropJwtApiM2MPayload;

export type InteropApiToken = {
  header: InteropJwtHeader;
  payload: InteropJwtApiPayload;
  serialized: string;
};

// ==========================================
//     Interop API DPoP Tokens
// ==========================================
// Extends M2M base
// export const InteropJwtApiM2MDPoPPayload = InteropJwtApiM2MPayload.merge(
//   z.object({ cnf: CNF })
// );
// export type InteropJwtApiM2MDPoPPayload = z.infer<
//   typeof InteropJwtApiM2MDPoPPayload
// >;

// Extends M2M Admin base
export const InteropJwtApiM2MAdminDPoPPayload =
  InteropJwtApiM2MAdminPayload.merge(z.object({ cnf: CNF }));

export type InteropJwtApiM2MAdminDPoPPayload = z.infer<
  typeof InteropJwtApiM2MAdminDPoPPayload
>;

// Adding InteropJwtApiM2MDPoPPayload, InteropJwtApiM2MAdminDPoPPayload
export type InteropJwtDPoPApiPayload =
  | InteropJwtApiM2MAdminDPoPPayload
// | InteropJwtApiM2MDPoPPayload;
// export const InteropJwtApiM2MAdminDPoPPayload =
//   InteropJwtApiM2MAdminPayload.merge(z.object({ cnf: CNF }));
// export type InteropJwtApiM2MAdminDPoPPayload = z.infer<
//   typeof InteropJwtApiM2MAdminDPoPPayload
// >;

// Adding InteropJwtApiM2MDPoPPayload, InteropJwtApiM2MAdminDPoPPayload
// export type InteropJwtApiPayload =
//   | InteropJwtApiM2MAdminPayload
//   | InteropJwtApiM2MPayload
// | InteropJwtApiM2MAdminDPoPPayload
// | InteropJwtApiM2MDPoPPayload;

export type InteropApiDPoPToken = {
  header: InteropJwtHeader;
  payload: InteropJwtDPoPApiPayload;
  serialized: string;
};

// ==========================================
//  Interop MAINTENANCE Token
// ==========================================
export const InteropJwtMaintenancePayload = InteropJwtCommonPayload.merge(
  z.object({
    role: z.literal(systemRole.MAINTENANCE_ROLE),
    sub: z.string(),
  })
);
export type InteropJwtMaintenancePayload = z.infer<
  typeof InteropJwtMaintenancePayload
>;

// ==========================================
//    Interop INTERNAL Token
// ==========================================
export const InteropJwtInternalPayload = InteropJwtCommonPayload.merge(
  z.object({
    sub: z.string(),
    role: z.literal(systemRole.INTERNAL_ROLE),
  })
);
export type InteropJwtInternalPayload = z.infer<
  typeof InteropJwtInternalPayload
>;

export type InteropInternalToken = {
  header: InteropJwtHeader;
  payload: InteropJwtInternalPayload;
  serialized: string;
};

// ==========================================
//    Interop UI Token
// ==========================================
export const SessionClaims = z.object({
  uid: UserId,
  organization: z.object({
    id: SelfcareId,
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
  name: z.string().nullish(),
  family_name: z.string().nullish(),
  email: z.string().nullish(),
});
export type SessionClaims = z.infer<typeof SessionClaims>;

export const UserClaims = z.object({
  "user-roles": CommaSeparatedStringToArray(UserRole),
  organizationId: TenantId,
  selfcareId: SelfcareId,
  externalId: z.object({
    origin: z.string(),
    value: z.string(),
  }),
});
export type UserClaims = z.infer<typeof UserClaims>;

export const UIClaims = SessionClaims.merge(UserClaims);

export type UIClaims = z.infer<typeof UIClaims>;

export const InteropJwtUIPayload = InteropJwtCommonPayload.merge(
  UIClaims
).extend({
  // setting role to z.undefined() to make the discriminated union work.
  // z.discriminatedUnion performs better than z.union and gives more meaningful parsing errors.
  role: z.undefined(),
});

export type InteropJwtUIPayload = z.infer<typeof InteropJwtUIPayload>;

export type InteropUIToken = {
  header: InteropJwtHeader;
  payload: InteropJwtUIPayload;
  serialized: string;
};

// ===========================================
//    Parsing utilities
// ===========================================

// AuthTokenPayload is a discriminated union used to parse the payload of
// the auth token we receive in API requests. It includes only the payloads
// that we actually can receive. For example, it does not include the
// InteropJwtConsumerPayload, because interop generates it but never receives it in API requests.
// Adding InteropJwtApiM2MDPoPPayload, InteropJwtApiM2MAdminDPoPPayload
export const AuthTokenPayload = z.discriminatedUnion("role", [
  InteropJwtInternalPayload,
  InteropJwtUIPayload,
  InteropJwtApiM2MPayload,
  InteropJwtApiM2MAdminPayload,
  InteropJwtMaintenancePayload,
]);
export type AuthTokenPayload = z.infer<typeof AuthTokenPayload>;

export const AuthTokenDPoPPayload = z.discriminatedUnion("role", [
  // InteropJwtApiM2MDPoPPayload,
  InteropJwtApiM2MAdminDPoPPayload,
]);
export type AuthTokenDPoPPayload = z.infer<typeof AuthTokenDPoPPayload>;
