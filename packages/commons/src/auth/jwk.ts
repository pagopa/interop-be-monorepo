import crypto, { JsonWebKey, KeyObject } from "crypto";
import {
  invalidKey,
  jwkDecodingError,
  notAllowedPrivateKeyException,
} from "pagopa-interop-models";

const decodeBase64ToPem = (base64String: string): string => {
  try {
    const cleanedBase64 = base64String.trim();
    const decodedBytes = Buffer.from(cleanedBase64, "base64");
    return decodedBytes.toString("utf-8");
  } catch (error) {
    throw jwkDecodingError(error);
  }
};

export const createJWK = (key: string): JsonWebKey =>
  createPublicKey(key).export({ format: "jwk" });

export const calculateKid = (jwk: JsonWebKey): string => {
  const sortedJwk = sortJWK(jwk);
  const jwkString = JSON.stringify(sortedJwk);
  return crypto.createHash("sha256").update(jwkString).digest("base64url");
};

function createPublicKey(key: string): KeyObject {
  const pemKey = decodeBase64ToPem(key);
  try {
    crypto.createPrivateKey(pemKey);
  } catch {
    try {
      return crypto.createPublicKey(pemKey);
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
