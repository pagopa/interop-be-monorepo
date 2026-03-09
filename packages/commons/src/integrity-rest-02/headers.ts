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
}: {
  digest: string;
  contentType?: string | undefined;
  contentEncoding?: string | undefined;
}): IntegrityRest02SignedHeaders {
  const headers: IntegrityRest02SignedHeaders = [
    { digest: `SHA-256=${digest}` },
  ];
  if (contentType) {
    // eslint-disable-next-line functional/immutable-data
    headers.push({ "content-type": contentType });
  }
  if (contentEncoding) {
    // eslint-disable-next-line functional/immutable-data
    headers.push({ "content-encoding": contentEncoding });
  }

  return IntegrityRest02SignedHeaders.parse(headers);
}
