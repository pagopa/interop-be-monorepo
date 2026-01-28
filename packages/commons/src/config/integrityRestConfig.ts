import { z } from "zod";
import { IntegrityRestConfig } from "../integrity-rest/models.js";

/**
 * Configuration for INTEGRITY_REST_02 pattern implementation.
 * Used for signing response headers with Agid-JWT-Signature.
 *
 * Environment Variables:
 * - INTEGRITY_REST_KID: Key ID for the Gateway's signing key in AWS KMS
 * - INTEGRITY_REST_ISSUER: Unique identifier for the M2M Gateway
 * - INTEGRITY_REST_AUDIENCE: Identifier for the client/receiver
 * - INTEGRITY_REST_SIGNATURE_DURATION_SECONDS: Validity duration for signatures (optional, default: 60)
 * - INTEGRITY_REST_ENABLE_REPLAY_PROTECTION: Whether to include jti claim (optional, default: true)
 */
const IntegrityRestConfigFromEnv = z
  .object({
    INTEGRITY_REST_KID: z.string(),
    INTEGRITY_REST_ISSUER: z.string(),
    INTEGRITY_REST_AUDIENCE: z.string(),
    INTEGRITY_REST_SIGNATURE_DURATION_SECONDS: z.coerce.number().optional(),
    INTEGRITY_REST_ENABLE_REPLAY_PROTECTION: z.coerce.boolean().optional(),
  })
  .transform(
    (c): IntegrityRestConfig => ({
      kid: c.INTEGRITY_REST_KID,
      issuer: c.INTEGRITY_REST_ISSUER,
      audience: c.INTEGRITY_REST_AUDIENCE,
      signatureDurationSeconds:
        c.INTEGRITY_REST_SIGNATURE_DURATION_SECONDS ?? 60,
      enableReplayProtection: c.INTEGRITY_REST_ENABLE_REPLAY_PROTECTION ?? true,
    })
  );

export type IntegrityRestConfigFromEnv = z.infer<
  typeof IntegrityRestConfigFromEnv
>;

/**
 * Reads and validates INTEGRITY_REST_02 configuration from environment variables.
 *
 * @throws {Error} If required environment variables are missing or invalid
 * @returns Validated IntegrityRestConfig
 *
 * @example
 * const config = integrityRestConfig();
 * const service = new IntegrityJWSService(config);
 */
export const integrityRestConfig = (): IntegrityRestConfig =>
  IntegrityRestConfigFromEnv.parse(process.env);
