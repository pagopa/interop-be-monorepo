import crypto, { createHash, JsonWebKey, KeyObject } from "crypto";
import { importSPKI } from "jose";
import jwksClient, { JwksClient } from "jwks-rsa";
import {
  notAnRSAKey,
  invalidKeyLength,
  invalidPublicKey,
  jwkDecodingError,
  invalidJWKClaim,
  notAllowedCertificateException,
  notAllowedMultipleKeysException,
  notAllowedPrivateKeyException,
  keyTypeNotAllowed,
  JWKKeyRS256,
  JWKKeyES256,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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

export const createJWK = ({
  pemKeyBase64,
  strictCheck = true,
}: {
  pemKeyBase64: string;
  strictCheck?: boolean;
}): JsonWebKey =>
  createPublicKey({ key: pemKeyBase64, strictCheck }).export({ format: "jwk" });

export const calculateKid = (jwk: JsonWebKey): string => {
  const sortedJwk = sortJWK(jwk);
  const jwkString = JSON.stringify(sortedJwk);
  return crypto.createHash("sha256").update(jwkString).digest("base64url");
};
/* This is to avoid repeating the logic of the "calculateKid", 
and to have a more meaningful name 
for the generation of the CNF field inside the DPoP tokens */
export const calculateDPoPThumbprint = (jwk: JsonWebKey): string =>
  calculateKid(jwk);

export const calculateJWKThumbprint = (jwk: JsonWebKey): string => {
  const parsedJwk = match(jwk.kty)
    .with("RSA", () => {
      const result = JWKKeyRS256.safeParse(jwk);

      if (!result.success) {
        throw invalidJWKClaim();
      }
      return result.data;
    })
    .with("EC", () => {
      const result = JWKKeyES256.safeParse(jwk);

      if (!result.success) {
        throw invalidJWKClaim();
      }
      return result.data;
    })
    .otherwise(() => {
      throw keyTypeNotAllowed(jwk.kty);
    });

  const canonicalJwk = sortJWK(parsedJwk);

  return createHash("sha256")
    .update(JSON.stringify(canonicalJwk))
    .digest("base64url");
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

function assertSingleKey(keyString: string): void {
  const beginMatches = keyString.match(/-----BEGIN [^\r\n]+-----/g);

  if (beginMatches && beginMatches.length > 1) {
    throw notAllowedMultipleKeysException();
  }
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

async function tryToImportSPKI(pem: string, alg: string): Promise<KeyObject> {
  try {
    return await importSPKI<KeyObject>(pem, alg);
  } catch {
    throw invalidPublicKey();
  }
}

export function createPublicKey({
  key,
  strictCheck = true,
}: {
  key: string;
  strictCheck?: boolean;
}): KeyObject {
  const pemKey = decodeBase64ToPem(key);
  if (strictCheck) {
    assertSingleKey(pemKey);
  }
  assertNotPrivateKey(pemKey);
  assertNotCertificate(pemKey);
  const publicKey = tryToCreatePublicKey(pemKey);
  if (strictCheck) {
    assertValidRSAKey(publicKey);
    assertValidRSAKeyLength(publicKey);
  }
  return publicKey;
}

const SPKI_BEGIN_MARKER = "-----BEGIN PUBLIC KEY-----";
const SPKI_END_MARKER = "-----END PUBLIC KEY-----";
const BASE64_BODY_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/* Reads stay on the tolerant `createPublicKey` path: keys stored before this
sanitization cannot be corrected and jose rejects them. The kid is unaffected,
it derives from the key material and not from its encoding. */
export async function sanitizePublicKey({
  pemKeyBase64,
  alg,
}: {
  pemKeyBase64: string;
  alg: string;
}): Promise<{ jwk: JsonWebKey; sanitizedPemKeyBase64: string }> {
  const pemKey = decodeBase64ToPem(pemKeyBase64);

  assertSingleKey(pemKey);
  assertNotPrivateKey(pemKey);
  assertNotCertificate(pemKey);

  // indexOf instead of a regex: a lazy group between the two markers
  // backtracks polynomially on crafted input.
  const envelopeStart = pemKey.indexOf(SPKI_BEGIN_MARKER);
  if (envelopeStart === -1) {
    throw invalidPublicKey();
  }

  const bodyStart = envelopeStart + SPKI_BEGIN_MARKER.length;
  const bodyEnd = pemKey.indexOf(SPKI_END_MARKER, bodyStart);
  if (bodyEnd === -1) {
    throw invalidPublicKey();
  }

  // jose decodes the body with `Buffer.from(body, "base64")`, which drops
  // characters outside the alphabet; readers use OpenSSL, which does not.
  const body = pemKey.slice(bodyStart, bodyEnd).replace(/\s/g, "");
  if (!BASE64_BODY_REGEX.test(body)) {
    throw invalidPublicKey();
  }

  const publicKey = await tryToImportSPKI(
    `${SPKI_BEGIN_MARKER}\n${body}\n${SPKI_END_MARKER}\n`,
    alg
  );

  assertValidRSAKey(publicKey);
  assertValidRSAKeyLength(publicKey);

  // Exported from the parsed key, so the stored PEM is readable by construction.
  const sanitizedPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();

  return {
    jwk: publicKey.export({ format: "jwk" }),
    sanitizedPemKeyBase64: Buffer.from(sanitizedPem, "utf-8").toString(
      "base64"
    ),
  };
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
