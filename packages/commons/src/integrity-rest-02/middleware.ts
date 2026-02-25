import { Request, Response, NextFunction } from "express";
import { KMSClient } from "@aws-sdk/client-kms";
import { IntegrityRest02SignatureConfig } from "../config/index.js";
import { InteropTokenGenerator } from "../interop-token/interopTokenService.js";
import {
  calculateIntegrityRest02DigestFromBody,
  JsonReplacer,
  JsonSpaces,
} from "./digest.js";
import { buildIntegrityRest02SignedHeaders } from "./headers.js";

// The context may or may not be present (e.g if the user is not authorised)
interface AuthData {
  clientId?: string;
}

interface RequestWithMaybeContext extends Request {
  ctx?: {
    authData?: AuthData;
  };
}

/**
 * Middleware for Integrity REST 02 responses. Calculates Digest and signs Agid-JWT-Signature automatically
 * and sets the "digest" and "agid-jwt-signature" headers on the response.
 * This middleware uses the "json replacer" and "json spaces" options from the response object to ensure
 * that the body is converted to a canonical JSON representation.
 *
 * Also note that, to have the Digest and Agid-JWT-Signature headers set on the response even if the
 * authorisation is not successful, this middleware needs to be _before_ the authentication middleware.
 *
 * @param config - The token generation configuration.
 * @param kmsClient - The KMS client.
 * @returns The middleware function.
 */
export function integrityRest02Middleware(
  config: IntegrityRest02SignatureConfig,
  kmsClient: KMSClient
) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return (req: RequestWithMaybeContext, res: Response, next: NextFunction) => {
    // Keep original res.send
    const originalSend = res.send.bind(res);

    // eslint-disable-next-line functional/immutable-data
    res.send = (body?: unknown): Response => {
      const correlationId = res.getHeader("x-correlation-id") as
        | string
        | undefined;
      const clientId = req.ctx?.authData?.clientId ?? correlationId;

      const replacer =
        (res.app.get("json replacer") as JsonReplacer) ?? undefined;
      const spaces = (res.app.get("json spaces") as JsonSpaces) ?? undefined;
      const digest = calculateIntegrityRest02DigestFromBody({
        body,
        replacer,
        spaces,
      });
      const signedHeaders = buildIntegrityRest02SignedHeaders({
        res,
        digest,
      });

      const tokenGenerator = new InteropTokenGenerator(config, kmsClient);

      tokenGenerator
        .generateAgidIntegrityRest02Token({
          signedHeaders,
          aud: clientId,
          sub: correlationId,
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
