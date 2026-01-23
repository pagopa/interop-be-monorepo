import { Request, Response } from "express";
import {
  badBearerToken,
  badDPoPToken,
  badDPoPProof,
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

export function parseDPoPHeader(req: Request): string | undefined {
  // check for existence and type (non-empty string)
  const parsed = z.object({ dpop: z.string().min(1) }).safeParse(req.headers);

  if (parsed.success) {
    return parsed.data.dpop;
  }
  return undefined;
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

  // check for missing DPoP header
  if (req.headers.dpop === undefined) {
    logger.warn(`Missing DPoP proof for this call ${req.method} ${req.url}`);
    throw missingHeader("DPoP");
  }

  // check for malformed DPoP header value
  const dpopProofJWS = parseDPoPHeader(req);
  if (!dpopProofJWS) {
    logger.warn(
      `Invalid authentication provided for this call ${req.method} ${req.url}: malformed DPoP header`
    );
    throw badDPoPProof;
  }

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
