import {
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  PurposeId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { z } from "zod";
import { SystemRole } from "../auth/authData.js";

export const ORGANIZATION = "organization";
export const UID = "uid";
export const NAME = "name";
export const FAMILY_NAME = "family_name";
export const EMAIL = "email";
export const ORGANIZATION_ID_CLAIM = "organizationId";
export const SELFCARE_ID_CLAIM = "selfcareId";
export const ORGANIZATION_EXTERNAL_ID_CLAIM = "externalId";
export const ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM = "origin";
export const ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM = "value";
export const USER_ROLES = "user-roles";
const PURPOSE_ID_CLAIM = "purposeId";
export const ROLE_CLAIM = "role";

export interface InteropJwtHeader {
  alg: string;
  use: string;
  typ: string;
  kid: string;
}

export type InteropJwtCommonPayload = {
  jti: string;
  iss: string;
  aud: string[] | string;
  iat: number;
  nbf: number;
  exp: number;
};

/* ========================================== 
    Interop CONSUMER Token 
  ========================================== */
export type InteropJwtConsumerPayload = InteropJwtCommonPayload & {
  client_id: ClientId;
  sub: ClientId;
  [PURPOSE_ID_CLAIM]: PurposeId;
  digest?: ClientAssertionDigest;
  // TODO: the new claims are behind the feature flag FEATURE_FLAG_IMPROVED_PRODUCER_VERIFICATION_CLAIMS. They should become required after the feature flag disappears.
  producerId?: TenantId;
  consumerId?: TenantId;
  eserviceId?: EServiceId;
  descriptorId?: DescriptorId;
};

export type InteropConsumerToken = {
  header: InteropJwtHeader;
  payload: InteropJwtConsumerPayload;
  serialized: string;
};

/* ========================================== 
    Interop API Token 
  ========================================== */
export type InteropJwtApiCommonPayload = InteropJwtCommonPayload & {
  client_id: ClientId;
  sub: ClientId;
  [ORGANIZATION_ID_CLAIM]: TenantId;
};

export type InteropJwtApiM2MPayload = InteropJwtApiCommonPayload & {
  [ROLE_CLAIM]: Extract<SystemRole, "m2m">;
};

export type InteropJwtApiM2MAdminPayload = InteropJwtApiCommonPayload & {
  [ROLE_CLAIM]: Extract<SystemRole, "m2m-admin">;
  adminId: UserId;
  // ^ ID of the admin user associated with the client
};

export type InteropJwtApiPayload =
  | InteropJwtApiM2MAdminPayload
  | InteropJwtApiM2MPayload;

export type InteropApiToken = {
  header: InteropJwtHeader;
  payload: InteropJwtApiPayload;
  serialized: string;
};

/* ========================================== 
    Interop INTERNAL Token 
  ========================================== */
export type InteropJwtInternalPayload = InteropJwtCommonPayload & {
  sub: string;
  role: Extract<SystemRole, "internal">;
};

export type InteropInternalToken = {
  header: InteropJwtHeader;
  payload: InteropJwtInternalPayload;
  serialized: string;
};

/* ========================================== 
    Interop SESSION Token 
  ========================================== */
const Organization = z.object({
  id: z.string(),
  name: z.string(),
  roles: z.array(z.object({ role: z.string() })),
});
export const SessionClaims = z.object({
  [UID]: z.string(),
  [ORGANIZATION]: Organization,
  [NAME]: z.string().optional(),
  [FAMILY_NAME]: z.string().optional(),
  [EMAIL]: z.string().optional(),
});
export type SessionClaims = z.infer<typeof SessionClaims>;

export const CustomClaims = z.object({
  [USER_ROLES]: z.string(),
  [ORGANIZATION_ID_CLAIM]: z.string(),
  [SELFCARE_ID_CLAIM]: z.string(),
  [ORGANIZATION_EXTERNAL_ID_CLAIM]: z.object({
    [ORGANIZATION_EXTERNAL_ID_ORIGIN_CLAIM]: z.string(),
    [ORGANIZATION_EXTERNAL_ID_VALUE_CLAIM]: z.string(),
  }),
});
export type CustomClaims = z.infer<typeof CustomClaims>;

export type SessionJwtPayload = InteropJwtCommonPayload &
  SessionClaims &
  CustomClaims;

export type SessionToken = {
  header: InteropJwtHeader;
  payload: SessionJwtPayload;
  serialized: string;
};
