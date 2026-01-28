/**
 * INTEGRITY_REST_02 Pattern Implementation
 *
 * This module implements the AgID interoperability guidelines for ensuring
 * payload integrity of HTTP responses through cryptographic signing.
 *
 * Components:
 * - Digest calculation (RFC 3230) with SHA-256
 * - JWS creation and signing with AWS KMS
 * - Express middleware for automatic header injection
 */

export * from "./models.js";
export * from "./digest.js";
export * from "./jwsService.js";
export * from "./middleware.js";
