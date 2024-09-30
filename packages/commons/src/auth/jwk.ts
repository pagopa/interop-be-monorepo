import crypto, { JsonWebKey, KeyObject } from "crypto";
import {
  invalidKey,
  jwkDecodingError,
  notAllowedCertificateException,
  notAllowedPrivateKeyException,
} from "pagopa-interop-models";
import jwksClient, { JwksClient } from "jwks-rsa";
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

function createPublicKey(key: string): KeyObject {
  const pemKey = decodeBase64ToPem(key);

  assertNotPrivateKey(pemKey);
  assertNotCertificate(pemKey);

  try {
    return crypto.createPublicKey(pemKey);
  } catch (error) {
    throw invalidKey(key, error);
  }
}

export function sortJWK(jwk: JsonWebKey): JsonWebKey {
  return [...Object.keys(jwk)]
    .sort()
    .reduce<JsonWebKey>(
      (prev, sortedKey) => ({ ...prev, [sortedKey]: jwk[sortedKey] }),
      {}
    );
}

export function getJwksClient(): JwksClient[] {
  const config = JWTConfig.parse(process.env);
  return config.wellKnownUrls.map((url) =>
    jwksClient({
      cache: true,
      cacheMaxEntries: 50,
      timeout: 30000,
      cacheMaxAge: 3600000, // 60 minutes
      jwksRequestsPerMinute: 30,
      jwksUri: url,
    })
  );
}
