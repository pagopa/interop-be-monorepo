import { Request, Response } from "express";
import {
  badBearerToken,
  badDPoPToken,
  missingHeader,
} from "pagopa-interop-models";
import { z } from "zod";
import { Logger } from "../logging/index.js";

export function parseCorrelationIdHeader(req: Request): string | undefined {
  const parsed = z
    .object({ "x-correlation-id": z.string() })
    .safeParse(req.headers);

  if (parsed.success) {
    return parsed.data["x-correlation-id"];
  }
  return undefined;
}
export function parseAuthHeader(req: Request): string | undefined {
  const parsed = z.object({ authorization: z.string() }).safeParse(req.headers);

  if (parsed.success) {
    return parsed.data.authorization;
  }
  return undefined;
}

export function parseDPoPHeader(req: Request, logger: Logger): string {
  const parsed = z.object({ dpop: z.string().min(1) }).safeParse(req.headers);

  if (!parsed.success) {
    logger.warn(
      `Invalid authentication provided for this call ${req.method} ${req.url} - missing or malformed DPoP header`
    );
    throw missingHeader("DPoP");
  }

  return parsed.data.dpop;
}

export function jwtFromAuthHeader(req: Request, logger: Logger): string {
  const authHeader = parseAuthHeader(req);
  if (!authHeader) {
    throw missingHeader("Authorization");
  }

  const authHeaderParts = authHeader.split(" ");
  if (authHeaderParts.length !== 2 || authHeaderParts[0] !== "Bearer") {
    logger.warn(
      `Invalid authentication provided for this call ${req.method} ${req.url}`
    );
    throw badBearerToken;
  }

  return authHeaderParts[1];
}

/**
 * Extracts and validates the presence of the:
 * (1) Access Token DPoP and
 * (2) the DPoP Proof
 * from the HTTP request headers.
 *
 * This function performs a syntax and presence check on the `Authorization` and `DPoP` headers.
 * It does not verify the cryptographic signatures or the claims of the tokens.
 *
 * @param req - The Express `Request` object containing the HTTP headers.
 * @param logger - The `Logger` instance used to log warnings in case of missing or malformed headers.
 *
 * @returns An object containing the raw strings of the Access Token and the DPoP Proof JWS.
 *
 * @throws {missingHeader} If the `Authorization` header is missing entirely.
 * @throws {badDPoPToken} If the `Authorization` scheme is not "DPoP" or the token value is missing.
 * @throws {missingHeader} If the `DPoP` header is missing or malformed (e.g., empty or invalid format according to `parseDPoPHeader`)
 *
 */
export function jwtsFromAuthAndDPoPHeaders(
  req: Request,
  logger: Logger
): { accessToken: string; dpopProofJWS: string } {
  const authHeader = parseAuthHeader(req);
  if (!authHeader) {
    throw missingHeader("Authorization");
  }

  const [scheme, accessToken] = authHeader.split(" ");
  if (scheme !== "DPoP" || !accessToken) {
    logger.warn(
      `Invalid authentication provided for this call ${req.method} ${req.url}`
    );
    throw badDPoPToken;
  }
  const dpopProofJWS = parseDPoPHeader(req, logger);
  return {
    accessToken,
    dpopProofJWS,
  };
}

export const METADATA_VERSION_HEADER = "x-metadata-version";
export function setMetadataVersionHeader(
  res: Response,
  metadata: { version: number }
): void {
  res.set(METADATA_VERSION_HEADER, metadata.version.toString());
}
