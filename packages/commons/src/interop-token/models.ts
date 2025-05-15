import {
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { z } from "zod";
import {
  SUPPORT_USER_ID,
  systemRole,
  userRole,
  UserRole,
} from "../auth/roles.js";

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
    // TODO: the new claims are behind a feature flag. Maybe they should become required after the feature flag disappears
    producerId: TenantId.optional(),
    consumerId: TenantId.optional(),
    eserviceId: EServiceId.optional(),
    descriptorId: DescriptorId.optional(),
  })
);
export type InteropJwtConsumerPayload = z.infer<
  typeof InteropJwtConsumerPayload
>;

export const InteropConsumerToken = z.object({
  header: InteropJwtHeader,
  payload: InteropJwtConsumerPayload,
  serialized: z.string(),
});
export type InteropConsumerToken = z.infer<typeof InteropConsumerToken>;

// ==========================================
//     Interop M2M API Tokens
// ==========================================
export const InteropJwtApiM2MCommonPayload = InteropJwtCommonPayload.merge(
  z.object({
    client_id: ClientId,
    sub: ClientId,
    organizationId: TenantId,
  })
);
export type InteropJwtApiM2MCommonPayload = z.infer<
  typeof InteropJwtApiM2MCommonPayload
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

export type InteropJwtApiM2MPayload =
  | InteropJwtApiM2MAdminPayload
  | InteropJwtApiM2MPayload;

export type InteropApiM2MToken = {
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
//   Interop UI Token
// ==========================================
export const InteropJwtUIPayload = InteropJwtCommonPayload.merge(
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
export type InteropJwtUIPayload = z.infer<typeof InteropJwtUIPayload>;

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
//    Interop SESSION Token
// ==========================================
export const SessionClaims = z.object({
  uid: z.string(),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    roles: z.array(z.object({ role: z.string() })),
  }),
  name: z.string().optional(),
  family_name: z.string().optional(),
  email: z.string().optional(),
});
export type SessionClaims = z.infer<typeof SessionClaims>;

export const InteropUserJwtPayload = z.object({
  "user-roles": z.string(),
  organizationId: z.string(),
  selfcareId: z.string(),
  externalId: z.object({
    origin: z.string(),
    value: z.string(),
  }),
});
export type InteropUserJwtPayload = z.infer<typeof InteropUserJwtPayload>;

export type SessionJwtPayload = InteropJwtCommonPayload &
  SessionClaims &
  InteropUserJwtPayload;

export type SessionToken = {
  header: InteropJwtHeader;
  payload: SessionJwtPayload;
  serialized: string;
};

/* ========================================== 
    Interop SUPPORT Token 
  ========================================== */
export const SupportJwtPayload = InteropUserJwtPayload.merge(
  z.object({
    "user-roles": z.literal(userRole.SUPPORT_ROLE),
    uid: z.literal(SUPPORT_USER_ID),
    organization: z.object({
      id: z.string(),
      name: z.string(),
      roles: z.array(
        z.object({
          role: z.literal(userRole.SUPPORT_ROLE),
        })
      ),
    }),
  })
);
export type SupportJwtPayload = z.infer<typeof SupportJwtPayload>;

export const AuthTokenPayload = z.discriminatedUnion("role", [
  InternalJwtAuthPayload,
  InteropJwtUIPayload,
  InteropJwtApiM2MPayload,
  InteropJwtApiM2MAdminPayload,
  InteropJwtMaintenancePayload,
]);
export type AuthTokenPayload = z.infer<typeof AuthTokenPayload>;
