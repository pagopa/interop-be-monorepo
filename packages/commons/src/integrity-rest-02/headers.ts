import { Response } from "express";
import { z } from "zod";

export const SignedHeader = z.object({
  name: z.string().min(1),
  value: z.string(),
});

export type SignedHeader = z.infer<typeof SignedHeader>;

export const SignedHeadersSchema = z.array(SignedHeader).min(1);

export type SignedHeaders = z.infer<typeof SignedHeadersSchema>;

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
}): SignedHeaders {
  const contentType = res.getHeader("Content-Type")?.toString() ?? "";
  const contentEncoding = res.getHeader("Content-Encoding")?.toString();

  const headers: SignedHeader[] = [
    { name: "digest", value: `SHA-256=${digest}` },
    { name: "content-type", value: contentType },
    ...(contentEncoding
      ? [{ name: "content-encoding", value: contentEncoding }]
      : []),
  ];

  return SignedHeadersSchema.parse(headers);
}
