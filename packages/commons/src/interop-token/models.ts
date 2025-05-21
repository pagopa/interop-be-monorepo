import {
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  PurposeId,
  TenantId,
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

const InteropJwtCommonPayload = z.object({
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
export const InteropJwtConsumerPayload = InteropJwtCommonPayload.merge(
  z.object({
    client_id: ClientId,
    sub: ClientId,
    purposeId: PurposeId,
    digest: ClientAssertionDigest.optional(),
    // TODO: the new claims are behind the feature flag FEATURE_FLAG_IMPROVED_PRODUCER_VERIFICATION_CLAIMS. They should become required after the feature flag disappears.
    producerId: TenantId.optional(),
    consumerId: TenantId.optional(),
    eserviceId: EServiceId.optional(),
    descriptorId: DescriptorId.optional(),
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
    adminId: z.string().uuid(),
    // ^ ID of the admin user associated with the client
  })
);
export type InteropJwtApiM2MAdminPayload = z.infer<
  typeof InteropJwtApiM2MAdminPayload
>;

export type InteropJwtApiPayload =
  | InteropJwtApiM2MAdminPayload
  | InteropJwtApiM2MPayload;

export type InteropApiToken = {
  header: InteropJwtHeader;
  payload: InteropJwtApiPayload;
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
  uid: z.string().uuid(),
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
  name: z.string().nullish(),
  family_name: z.string().nullish(),
  email: z.string().nullish(),
});
export type SessionClaims = z.infer<typeof SessionClaims>;

export const ui_Role = "ORGANIZATION_USER_ROLES";

export const UserClaims = z.object({
  "user-roles": z.string(),
  organizationId: z.string().uuid(),
  selfcareId: z.string().uuid(),
  externalId: z.object({
    origin: z.string(),
    value: z.string(),
  }),
  // This field is required solely to support the correct functioning of the discriminated union.
  // The actual roles assigned to the user are defined in the 'user-roles' claim.
  role: z.literal(ui_Role),
});
export type UserClaims = z.infer<typeof UserClaims>;

export const UIClaims = SessionClaims.merge(UserClaims);

export type UIClaims = z.infer<typeof UIClaims>;

export const InteropJwtUIPayload = InteropJwtCommonPayload.merge(UIClaims);

export type InteropJwtUIPayload = z.infer<typeof InteropJwtUIPayload>;

export type InteropUIToken = {
  header: InteropJwtHeader;
  payload: InteropJwtUIPayload;
  serialized: string;
};

export const AuthTokenPayload = z.discriminatedUnion("role", [
  InteropJwtInternalPayload,
  InteropJwtUIPayload,
  InteropJwtApiM2MPayload,
  InteropJwtApiM2MAdminPayload,
  InteropJwtMaintenancePayload,
]);
export type AuthTokenPayload = z.infer<typeof AuthTokenPayload>;
