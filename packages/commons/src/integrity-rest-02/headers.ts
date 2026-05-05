import { IntegrityRest02SignedHeaders } from "../interop-token/models.js";

/**
 * Build signed headers for Integrity REST 02 responses.
 *
 * This takes a response and a digest and returns only the headers that
 * will need to be used in the `signed_headers` parameter of the Agid-JWT-Signature.
 */
export function buildIntegrityRest02SignedHeaders({
  digest,
  contentType,
  contentEncoding,
  correlationId,
}: {
  digest: string;
  contentType?: string | undefined;
  contentEncoding?: string | undefined;
  correlationId: string;
}): IntegrityRest02SignedHeaders {
  const headers: IntegrityRest02SignedHeaders = [
    { digest: `SHA-256=${digest}` },
    { "x-correlation-id": correlationId },
    ...(contentType ? [{ "content-type": contentType }] : []),
    ...(contentEncoding ? [{ "content-encoding": contentEncoding }] : []),
  ];

  return IntegrityRest02SignedHeaders.parse(headers);
}
