import { Response } from "express";
import { IntegrityRest02SignedHeader } from "../interop-token/models.js";
/**
 * Build signed headers for Integrity REST 02 responses.
 *
 * This takes a response and a digest and returns an array of signed headers
 * that can be used to sign the response.
 */
export function buildIntegrityRest02SignedHeaders({
  res,
  digest,
}: {
  res: Response;
  digest: string;
}): IntegrityRest02SignedHeader {
  const contentType = res.getHeader("Content-Type")?.toString() ?? "";
  const contentEncoding = res.getHeader("Content-Encoding")?.toString();

  const headers: IntegrityRest02SignedHeader = {
    digest: `SHA-256=${digest}`,
    "content-type": contentType,
    ...(contentEncoding ? { "content-encoding": contentEncoding } : {}),
  };

  return IntegrityRest02SignedHeader.parse(headers);
}
