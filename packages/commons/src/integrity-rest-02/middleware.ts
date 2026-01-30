import { Request, Response, NextFunction } from "express";
import { TokenGenerationConfig } from "../config/index.js";
import { calculateDigestFromBody } from "./digest.js";
import { buildAgidJwtSignature } from "./payload.js";
import { buildIntegrityRest02SignedHeaders } from "./headers.js";
import { readBase64FromPrivateKeyFile } from "./key.js";

/**
 * Middleware for Integrity REST 02 responses
 * Calculates Digest and signs Agid-JWT-Signature automatically.
 */
export function integrityRest02Middleware(
  privateKey: string, // Temporary, figure out where to get the key
  config: TokenGenerationConfig
) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return (_req: Request, res: Response, next: NextFunction) => {
    // Keep original res.send
    const originalSend = res.send.bind(res);

    // eslint-disable-next-line functional/immutable-data
    res.send = (body?: unknown): Response => {
      // Only process if there is a body
      if (body !== undefined) {
        // Step 1: Calculate Digest
        const digest = calculateDigestFromBody(body);

        // Step 2: Build signed headers
        const signedHeaders = buildIntegrityRest02SignedHeaders({
          res,
          digest,
        });

        const privateKeyBase64 = readBase64FromPrivateKeyFile(privateKey);

        // // Step 3: Build and set Agid-JWT-Signature
        const agidSignature = buildAgidJwtSignature({
          signedHeaders,
          privateKeyBase64,
          kid: config.kid,
          issuer: config.issuer,
          audience: config.audience,
          sub: config.subject,
          ttlSeconds: config.secondsDuration,
        });

        // Set the headers for Integrity Rest 02
        res.setHeader("Digest", `SHA-256=${digest}`);
        res.setHeader("Agid-JWT-Signature", agidSignature);
      }

      // Step 4: Send the response
      return originalSend(body);
    };

    next();
  };
}
