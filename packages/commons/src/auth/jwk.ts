import crypto, { JsonWebKey, KeyObject } from "crypto";
import jwksClient, { JwksClient } from "jwks-rsa";
import {
  notAnRSAKey,
  invalidKeyLength,
  invalidPublicKey,
  jwkDecodingError,
  notAllowedCertificateException,
  notAllowedPrivateKeyException,
} from "pagopa-interop-models";
import { JWTConfig } from "../config/index.js";

export const decodeBase64ToPem = (base64String: string): string => {
  try {
    const cleanedBase64 = base64String.trim();
    const decodedBytes = Buffer.from(cleanedBase64, "base64");
    return decodedBytes.toString("utf-8");
  } catch (error) {
    throw jwkDecodingError(error);
  }
};

export const createJWK = (pemKeyBase64: string): JsonWebKey =>
  createPublicKey(pemKeyBase64).export({ format: "jwk" });

export const calculateKid = (jwk: JsonWebKey): string => {
  const sortedJwk = sortJWK(jwk);
  const jwkString = JSON.stringify(sortedJwk);
  return crypto.createHash("sha256").update(jwkString).digest("base64url");
};

function assertNotCertificate(key: string): void {
  try {
    new crypto.X509Certificate(key);
  } catch (error) {
    return;
  }
  throw notAllowedCertificateException();
}

function assertNotPrivateKey(key: string): void {
  try {
    crypto.createPrivateKey(key);
  } catch {
    return;
  }
  throw notAllowedPrivateKeyException();
}

export function assertValidRSAKey(key: KeyObject): void {
  if (key.asymmetricKeyType !== "rsa") {
    throw notAnRSAKey();
  }
}

export function assertValidRSAKeyLength(
  key: KeyObject,
  minLength: number = 2048
): void {
  const length = key.asymmetricKeyDetails?.modulusLength;
  if (!length || length < minLength) {
    throw invalidKeyLength(length, minLength);
  }
}

function tryToCreatePublicKey(key: string): KeyObject {
  try {
    return crypto.createPublicKey(key);
  } catch {
    throw invalidPublicKey();
  }
}

export function createPublicKey(key: string): KeyObject {
  const pemKey = decodeBase64ToPem(key);
  assertNotPrivateKey(pemKey);
  assertNotCertificate(pemKey);
  const publicKey = tryToCreatePublicKey(pemKey);
  assertValidRSAKey(publicKey);
  assertValidRSAKeyLength(publicKey);
  return publicKey;
}

export function sortJWK(jwk: JsonWebKey): JsonWebKey {
  return [...Object.keys(jwk)]
    .sort()
    .reduce<JsonWebKey>(
      (prev, sortedKey) => ({ ...prev, [sortedKey]: jwk[sortedKey] }),
      {}
    );
}

export function buildJwksClients(config: JWTConfig): JwksClient[] {
  return config.wellKnownUrls.map((url) =>
    jwksClient({
      jwksUri: url,
      /* If JWKS_CACHE_MAX_AGE_MILLIS not provided using 10 minutes as default value:
      https://github.com/auth0/node-jwks-rsa/blob/master/EXAMPLES.md#configuration
      */

      // Caching is not being leveraged at the moment since we are building
      // a new client for each request.
      // Building clients only once at startup caused https://pagopa.atlassian.net/browse/PIN-5682
      // cache: true,
      // rateLimit: true,
      // cacheMaxAge: config.jwksCacheMaxAge ?? 600000,
    })
  );
}
