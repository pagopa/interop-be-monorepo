import { Request, Response, NextFunction } from "express";
import { KMSClient } from "@aws-sdk/client-kms";
import { TokenGenerationConfig } from "../config/index.js";
import { InteropTokenGenerator } from "../interop-token/interopTokenService.js";
import { calculateIntegrityRest02DigestFromBody } from "./digest.js";
import { buildIntegrityRest02SignedHeaders } from "./headers.js";

/**
 * Middleware for Integrity REST 02 responses
 * Calculates Digest and signs Agid-JWT-Signature automatically.
 */
export function integrityRest02Middleware(
  config: TokenGenerationConfig,
  kmsClient: KMSClient
) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return (_req: Request, res: Response, next: NextFunction) => {
    // Keep original res.send
    const originalSend = res.send.bind(res);

    // eslint-disable-next-line functional/immutable-data
    res.send = (body?: unknown): Response => {
      if (body === undefined) {
        return originalSend(body);
      }

      const digest = calculateIntegrityRest02DigestFromBody(body);
      const signedHeaders = buildIntegrityRest02SignedHeaders({
        res,
        digest,
      });

      const tokenGenerator = new InteropTokenGenerator(config, kmsClient);

      tokenGenerator
        .generateAgidIntegrityRest02Token({
          signedHeaders,
        })
        .then((agidSignature) => {
          res.setHeader("Digest", `SHA-256=${digest}`);
          res.setHeader("Agid-JWT-Signature", agidSignature);
          originalSend(body);
        })
        .catch((err) => {
          next(err);
        });

      return res;
    };

    next();
  };
}
