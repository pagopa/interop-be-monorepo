import crypto from "crypto";
import { DigestAlgorithm, DigestResult } from "./models.js";

/**
 * Deterministic Base64 value for an empty SHA-256 digest.
 * This is the result of hashing a zero-byte input with SHA-256.
 * Used when the response body is empty (e.g., 204 No Content).
 */
export const EMPTY_DIGEST_SHA256 =
  "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

/**
 * Calculates the SHA-256 digest of the response payload following RFC 3230.
 *
 * Process:
 * 1. Serialization: Captures the exact response payload as it will be transmitted
 * 2. Hashing: Applies SHA-256 algorithm to the serialized byte sequence
 * 3. Encoding: Encodes the resulting binary digest into Base64
 *
 * @param payload - The response body as a string or Buffer
 * @param algorithm - The digest algorithm to use (default: SHA-256)
 * @returns DigestResult containing algorithm, value, and header format
 *
 * @example
 * // For a JSON response
 * const response = JSON.stringify({ status: "success" });
 * const digest = calculateDigest(response);
 * // Returns: { algorithm: "SHA-256", value: "abc123...", headerValue: "SHA-256=abc123..." }
 *
 * @example
 * // For an empty response
 * const digest = calculateDigest("");
 * // Returns: { algorithm: "SHA-256", value: "47DEQpj8...", headerValue: "SHA-256=47DEQpj8..." }
 */
export function calculateDigest(
  payload: string | Buffer,
  algorithm: DigestAlgorithm = "SHA-256"
): DigestResult {
  // Handle empty payload case
  if (!payload || payload.length === 0) {
    return {
      algorithm,
      value: EMPTY_DIGEST_SHA256,
      headerValue: `${algorithm}=${EMPTY_DIGEST_SHA256}`,
    };
  }

  // Ensure payload is a Buffer for consistent hashing
  const buffer = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(payload, "utf-8");

  // Calculate SHA-256 hash
  const hash = crypto.createHash("sha256").update(buffer).digest();

  // Encode to Base64
  const base64Digest = hash.toString("base64");

  return {
    algorithm,
    value: base64Digest,
    headerValue: `${algorithm}=${base64Digest}`,
  };
}

/**
 * Validates that a provided digest matches the calculated digest of the payload.
 * Used for testing and verification purposes.
 *
 * @param payload - The response body to verify
 * @param digestHeader - The Digest header value (e.g., "SHA-256=abc123...")
 * @returns true if the digest matches, false otherwise
 *
 * @example
 * const response = JSON.stringify({ status: "success" });
 * const isValid = verifyDigest(response, "SHA-256=cFfTOCesrWTLVzxn...");
 */
export function verifyDigest(
  payload: string | Buffer,
  digestHeader: string
): boolean {
  // Parse the digest header (format: "SHA-256=base64value")
  const match = digestHeader.match(/^([A-Z0-9-]+)=(.+)$/);
  if (!match) {
    return false;
  }

  const [, algorithm, expectedValue] = match;

  // Only SHA-256 is supported per AgID guidelines
  if (algorithm !== "SHA-256") {
    return false;
  }

  const calculatedDigest = calculateDigest(payload, "SHA-256");
  return calculatedDigest.value === expectedValue;
}
