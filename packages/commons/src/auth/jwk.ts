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
    return decodedBytes.toString("utf-8").replaceAll("\n\n", "\n");
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

function createPublicKey(key: string): KeyObject {
  /*
  Validation of a public key in PEM format.
  The standard library does not provide a specific method.
  Note: crypto.createPublicKey cannot be used directly because it succeeds also when providing a private key.
  In order to perform the check, the function:
    1. tries to create a private key
      - success: the value is a private key and the function fails
      - failure: the value is not a private key and the function proceeds
    2. tries to create a public key
      - success: the value is a public key
      - failure: the value is not a key
  */
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
