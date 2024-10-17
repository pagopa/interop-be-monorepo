export interface InteropJwtHeader {
  alg: string;
  use: string;
  typ: string;
  kid: string;
}
export interface InteropJwtPayload {
  jti: string;
  iss: string;
  aud: string[];
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
}

export interface InteropToken {
  header: InteropJwtHeader;
  payload: InteropJwtPayload;
  serialized: string;
}

export interface InteropTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ClientAssertionAuditDetails {
  jwtId: string;
  issuedAt: number;
  algorithm: string;
  keyId: string;
  issuer: string;
  subject: string;
  audience: string;
  expirationTime: number;
}

export interface GeneratedTokenAuditDetails {
  jwtId: string;
  correlationId: string;
  issuedAt: number;
  clientId: string;
  organizationId: string;
  agreementId: string;
  eserviceId: string;
  descriptorId: string;
  purposeId: string;
  purposeVersionId: string;
  algorithm: string;
  keyId: string;
  audience: string;
  subject: string;
  notBefore: number;
  expirationTime: number;
  issuer: string;
  clientAssertion: ClientAssertionAuditDetails;
}
