import crypto, { JsonWebKey, KeyObject } from "crypto";
import {
  invalidKey,
  jwkDecodingError,
  notAllowedPrivateKeyException,
} from "pagopa-interop-models";

export const decodeBase64ToPem = (base64String: string): string => {
  try {
    const cleanedBase64 = base64String.trim();
    const decodedBytes = Buffer.from(cleanedBase64, "base64");
    return decodedBytes.toString("utf-8");
  } catch (error) {
    throw jwkDecodingError(error);
  }
};

export const createJWK = (pemKey: string): JsonWebKey =>
  createPublicKey(pemKey).export({ format: "jwk" });

export const calculateKid = (jwk: JsonWebKey): string => {
  const sortedJwk = sortJWK(jwk);
  const jwkString = JSON.stringify(sortedJwk);
  return crypto.createHash("sha256").update(jwkString).digest("base64url");
};

function createPublicKey(key: string): KeyObject {
  try {
    crypto.createPrivateKey(key);
  } catch {
    try {
      return crypto.createPublicKey(key);
    } catch (error) {
      throw invalidKey(key, error);
    }
  }
  throw notAllowedPrivateKeyException();
}

export function sortJWK(jwk: JsonWebKey): JsonWebKey {
  return [...Object.keys(jwk)]
    .sort()
    .reduce<JsonWebKey>(
      (prev, sortedKey) => ({ ...prev, [sortedKey]: jwk[sortedKey] }),
      {}
    );
}
