import {
  ClientAssertionDigest,
  ClientId,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { z } from "zod";

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
export const GENERATED_INTEROP_TOKEN_M2M_ROLE = "m2m";
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

export type InteropJwtConsumerPayload = InteropJwtCommonPayload & {
  client_id: ClientId;
  sub: ClientId;
  [PURPOSE_ID_CLAIM]: PurposeId;
  digest?: ClientAssertionDigest;
};

export type InteropJwtApiPayload = InteropJwtCommonPayload & {
  client_id: ClientId;
  sub: ClientId;
  [ORGANIZATION_ID_CLAIM]: TenantId;
  [ROLE_CLAIM]: string;
};

export type InteropJwtPayload = InteropJwtCommonPayload & {
  sub: string;
  role: string;
};

export type InteropToken = {
  header: InteropJwtHeader;
  payload: InteropJwtPayload;
  serialized: string;
};

export type InteropConsumerToken = {
  header: InteropJwtHeader;
  payload: InteropJwtConsumerPayload;
  serialized: string;
};

export type InteropApiToken = {
  header: InteropJwtHeader;
  payload: InteropJwtApiPayload;
  serialized: string;
};

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
