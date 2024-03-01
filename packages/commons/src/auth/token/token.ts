import { Algorithm } from "jsonwebtoken";

export type InternalToken = {
  serialized: string;
  jti: string;
  iat: number;
  exp: number;
  nbf: number;
  expIn: number;
  alg: Algorithm;
  kid: string;
  aud: string[];
  sub: string;
  iss: string;
};

export type CustomJWTClaims = Map<string, string>;

export type TokenSeed = {
  id: string;
  algorithm: Algorithm;
  kid: string;
  subject: string;
  issuer: string;
  issuedAt: number;
  nbf: number;
  expireAt: number;
  audience: string[];
  customClaims: CustomJWTClaims;
};

export type TokenPayloadSeed = {
  subject: string;
  audience: string[];
  tokenIssuer: string;
  expirationInSeconds: number;
};
