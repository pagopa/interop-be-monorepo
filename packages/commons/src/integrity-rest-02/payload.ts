import crypto from "crypto";
import jwt, { SignOptions, JwtHeader, JwtPayload } from "jsonwebtoken";
import { decodeBase64ToPem } from "../auth/jwk.js";
import { type IntegrityRest02SignedHeader } from "../interop-token/models.js";

/**
 * Options for signing a REST 02 response
 */
export interface SignRest02ResponseOptions {
  signedHeaders: IntegrityRest02SignedHeader;
  privateKeyBase64: string; // Base64-encoded PEM
  kid: string;
  issuer: string;
  audience: string | string[];
  sub?: string;
  ttlSeconds?: number;
  jti?: string;
}

/**
 * Build the Agid-JWT-Signature for a REST 02 response
 */
export function buildAgidJwtSignature({
  signedHeaders,
  privateKeyBase64,
  kid,
  issuer,
  audience,
  sub,
  ttlSeconds = 60,
  jti,
}: SignRest02ResponseOptions): string {
  // Step 1: Prepare JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    iat: now,
    exp: now + ttlSeconds,
    iss: issuer,
    aud: audience,
    sub,
    jti,
    signed_headers: signedHeaders,
  };

  // Step 2: Prepare JOSE header
  const header: JwtHeader = {
    alg: "RS256",
    typ: "JWT",
    kid,
  };

  // Step 3: Load private key
  const pem = decodeBase64ToPem(privateKeyBase64);
  const privateKeyValue = crypto.createPrivateKey(pem);

  const opts: SignOptions = {
    algorithm: "RS256",
    header,
  };

  // Step 4: Sign the JWT
  return jwt.sign(payload, privateKeyValue, opts);
}
