import { z } from "zod";
import { UIAuthToken } from "../auth/authData.js";

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

export const SessionClaims = z.object({
  [UID]: z.string(),
  [ORGANIZATION]: UIAuthToken.shape.organization.transform((o) => o.id),
  [NAME]: z.string(),
  [FAMILY_NAME]: z.string(),
  [EMAIL]: z.string(),
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

export type SessionJwtHeader = {
  alg: string;
  use: string;
  typ: string;
  kid: string;
};
export type SessionJwtPayload = {
  jti: string;
  iss: string;
  aud: string[];
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
} & SessionClaims &
  CustomClaims;

export type SessionToken = {
  header: SessionJwtHeader;
  payload: SessionJwtPayload;
  serialized: string;
};
