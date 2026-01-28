import { Request, Response, NextFunction } from "express";
import { IntegrityRestConfig, IntegrityHeaders } from "./models.js";
import { calculateDigest } from "./digest.js";
import { IntegrityJWSService } from "./jwsService.js";
import { Logger } from "../logging/index.js";

/**
 * Express middleware that implements the INTEGRITY_REST_02 pattern.
 * Adds Digest and Agid-JWT-Signature headers to all responses.
 *
 * The middleware:
 * 1. Intercepts the response before it's sent
 * 2. Calculates the SHA-256 digest of the response body
 * 3. Creates a JWS signature protecting critical headers
 * 4. Injects both headers into the response
 *
 * @param config - Configuration for integrity REST signing
 * @param logger - Logger instance for debugging and error tracking
 * @returns Express middleware function
 *
 * @example
 * import express from "express";
 * import { integrityRestMiddleware, integrityRestConfig } from "pagopa-interop-commons";
 *
 * const app = express();
 * const config = integrityRestConfig();
 * app.use(integrityRestMiddleware(config, logger));
 *
 * @remarks
 * This middleware should be applied early in the middleware chain, but after
 * any body-parsing middleware (express.json(), express.text(), etc.).
 */
export function integrityRestMiddleware(
  config: IntegrityRestConfig,
  logger: Logger
) {
  const jwsService = new IntegrityJWSService(config);

  return (_req: Request, res: Response, next: NextFunction): void => {
    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Track if headers have already been added to avoid duplication
    let headersAdded = false;

    /**
     * Intercepts response body and adds integrity headers.
     */
    const addIntegrityHeaders = async (
      body: unknown
    ): Promise<IntegrityHeaders | null> => {
      if (headersAdded) {
        return null;
      }

      try {
        // Convert body to string/buffer for digest calculation
        let bodyContent: string | Buffer = "";

        if (body === null || body === undefined) {
          // Empty body
          bodyContent = "";
        } else if (Buffer.isBuffer(body)) {
          bodyContent = body;
        } else if (typeof body === "string") {
          bodyContent = body;
        } else if (typeof body === "object") {
          // Serialize objects to JSON
          bodyContent = JSON.stringify(body);
        } else {
          // Convert primitive types to string
          bodyContent = String(body);
        }

        // Step 1: Calculate Digest (RFC 3230)
        const digestResult = calculateDigest(bodyContent);

        // Step 2: Get Content-Type (default to application/json if not set)
        const contentType =
          res.getHeader("content-type")?.toString() || "application/json";

        // Step 3: Create Agid-JWT-Signature
        const jwsToken = await jwsService.createAgidJwtSignature(
          digestResult.headerValue,
          contentType
        );

        // Step 4: Inject headers
        res.setHeader("Digest", digestResult.headerValue);
        res.setHeader("Agid-JWT-Signature", jwsToken.serialized);

        headersAdded = true;

        logger.debug(
          `INTEGRITY_REST_02 headers added: Digest=${digestResult.headerValue.substring(0, 20)}..., Agid-JWT-Signature=${jwsToken.serialized.substring(0, 30)}...`
        );

        return {
          digest: digestResult.headerValue,
          agidJwtSignature: jwsToken.serialized,
        };
      } catch (error) {
        logger.error(`Error adding INTEGRITY_REST_02 headers: ${error}`);
        // Don't block the response - fail gracefully
        return null;
      }
    };

    // Override res.send()
    res.send = function (body: unknown): Response {
      addIntegrityHeaders(body)
        .then(() => {
          originalSend.call(this, body);
        })
        .catch((error) => {
          logger.error(`Error in integrityRestMiddleware (send): ${error}`);
          originalSend.call(this, body);
        });
      return this;
    };

    // Override res.json()
    res.json = function (body: unknown): Response {
      addIntegrityHeaders(body)
        .then(() => {
          originalJson.call(this, body);
        })
        .catch((error) => {
          logger.error(`Error in integrityRestMiddleware (json): ${error}`);
          originalJson.call(this, body);
        });
      return this;
    };

    // Override res.end()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
      // Handle different signatures of res.end()
      const actualCallback = typeof encoding === "function" ? encoding : callback;
      const actualEncoding = typeof encoding === "string" ? encoding : undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callOriginalEnd = (...args: any[]): void => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (originalEnd as any).call(this, ...args);
      };

      if (chunk) {
        addIntegrityHeaders(chunk)
          .then(() => {
            if (actualEncoding && actualCallback) {
              callOriginalEnd(chunk, actualEncoding, actualCallback);
            } else if (actualEncoding) {
              callOriginalEnd(chunk, actualEncoding);
            } else if (actualCallback) {
              callOriginalEnd(chunk, actualCallback);
            } else {
              callOriginalEnd(chunk);
            }
          })
          .catch((error) => {
            logger.error(`Error in integrityRestMiddleware (end): ${error}`);
            if (actualEncoding && actualCallback) {
              callOriginalEnd(chunk, actualEncoding, actualCallback);
            } else if (actualEncoding) {
              callOriginalEnd(chunk, actualEncoding);
            } else if (actualCallback) {
              callOriginalEnd(chunk, actualCallback);
            } else {
              callOriginalEnd(chunk);
            }
          });
      } else {
        // No body - calculate digest for empty content
        addIntegrityHeaders("")
          .then(() => {
            if (actualCallback) {
              callOriginalEnd(actualCallback);
            } else {
              callOriginalEnd();
            }
          })
          .catch((error) => {
            logger.error(
              `Error in integrityRestMiddleware (end-empty): ${error}`
            );
            if (actualCallback) {
              callOriginalEnd(actualCallback);
            } else {
              callOriginalEnd();
            }
          });
      }

      return this;
    };

    next();
  };
}
