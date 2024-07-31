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

export const createJWK = (pemKeyBase64: string): JsonWebKey =>
  createPublicKey(pemKeyBase64).export({ format: "jwk" });

export const calculateKid = (jwk: JsonWebKey): string => {
  const sortedJwk = sortJWK(jwk);
  const jwkString = JSON.stringify(sortedJwk);
  return crypto.createHash("sha256").update(jwkString).digest("base64url");
};

function createPublicKey(key: string): KeyObject {
  /*
  In this function we use a little trick to check whether the key is a public or private key. 
  First let's decode what comes to us as input.
  After which we try to create a private key, if the creation is successful, we throw notAllowedPrivateKeyException(), 
  but if it is not successful we most likely received a string containing the information for a public key as input.
  With the second try catch we check if the key is formatted in the right way, 
  if so we create the public key, otherwise we throw invalidKey
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
