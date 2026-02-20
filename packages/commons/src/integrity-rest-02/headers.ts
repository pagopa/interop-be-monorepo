import { Response } from "express";
import { IntegrityRest02SignedHeader } from "../interop-token/models.js";
/**
 * Build signed headers for Integrity REST 02 responses.
 *
 * This takes a response and a digest and returns only the headers that
 * will need to be used in the `signed_headers` parameter of the Agid-JWT-Signature.
 */
export function buildIntegrityRest02SignedHeaders({
  res,
  digest,
}: {
  res: Response;
  digest: string;
}): IntegrityRest02SignedHeader {
  const contentType =
    res.getHeader("Content-Type")?.toString() ?? "application/json";
  const contentEncoding = res.getHeader("Content-Encoding")?.toString();

  const headers: IntegrityRest02SignedHeader = {
    digest: `SHA-256=${digest}`,
    "content-type": contentType,
    ...(contentEncoding ? { "content-encoding": contentEncoding } : {}),
  };

  return IntegrityRest02SignedHeader.parse(headers);
}
