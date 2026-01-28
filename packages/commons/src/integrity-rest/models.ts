import { z } from "zod";

// ================================================
// INTEGRITY_REST_02 Types and Models
// ================================================

/**
 * Represents the algorithm used for digest calculation.
 * Currently only SHA-256 is supported per AgID guidelines.
 */
export const DigestAlgorithm = z.enum(["SHA-256"]);
export type DigestAlgorithm = z.infer<typeof DigestAlgorithm>;

/**
 * Represents a single signed header in the JWS payload.
 * Each header is represented as an object with a single key-value pair.
 */
export const SignedHeader = z.record(z.string(), z.string());
export type SignedHeader = z.infer<typeof SignedHeader>;

/**
 * JOSE Header for the Agid-JWT-Signature JWS.
 * Contains cryptographic metadata and the key identifier.
 */
export const IntegrityJWSHeader = z.object({
  alg: z.enum(["RS256", "ES256"]), // Supported asymmetric algorithms
  typ: z.literal("JWT"), // Must be JWT per specification
  kid: z.string(), // Key ID for the Gateway's public key
});
export type IntegrityJWSHeader = z.infer<typeof IntegrityJWSHeader>;

/**
 * JWT Payload for the Agid-JWT-Signature.
 * Contains issuer, audience, timestamps, and the protected headers.
 */
export const IntegrityJWSPayload = z.object({
  iss: z.string(), // Issuer: Unique ID of the M2M Gateway
  aud: z.string(), // Audience: ID of the Client/Receiver
  iat: z.number(), // Issued At: Unix Timestamp
  exp: z.number(), // Expiration Time: Unix Timestamp
  jti: z.string().optional(), // JWT ID: Unique UUID (optional for replay protection)
  signed_headers: z.array(SignedHeader), // Array of protected HTTP headers
});
export type IntegrityJWSPayload = z.infer<typeof IntegrityJWSPayload>;

/**
 * Configuration required for generating the Agid-JWT-Signature.
 */
export const IntegrityRestConfig = z.object({
  kid: z.string(), // Key ID for signing
  issuer: z.string(), // Gateway identifier
  audience: z.string(), // Client identifier
  signatureDurationSeconds: z.number().default(60), // Signature validity duration (default: 60 seconds)
  enableReplayProtection: z.boolean().default(true), // Whether to include jti claim
});
export type IntegrityRestConfig = z.infer<typeof IntegrityRestConfig>;

/**
 * Result of digest calculation including the algorithm and encoded value.
 */
export interface DigestResult {
  algorithm: DigestAlgorithm;
  value: string; // Base64-encoded digest
  headerValue: string; // Full header value (e.g., "SHA-256=...")
}

/**
 * Complete JWS token structure including header, payload, and serialized form.
 */
export interface IntegrityJWSToken {
  header: IntegrityJWSHeader;
  payload: IntegrityJWSPayload;
  serialized: string; // JWS Compact Serialization
}

/**
 * Headers to be injected into the HTTP response.
 */
export interface IntegrityHeaders {
  digest: string; // Digest header (e.g., "SHA-256=...")
  agidJwtSignature: string; // Agid-JWT-Signature header (JWS Compact Serialization)
}
