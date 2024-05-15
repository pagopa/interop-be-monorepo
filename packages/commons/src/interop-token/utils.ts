/**
 * Encode a byte array to a url encoded base64 string, as specified in RFC 7515 Appendix C
 */
export const b64ByteUrlEncode = (b: Uint8Array): string =>
  bufferB64UrlEncode(Buffer.from(b));

/**
 * Encode a string to a url encoded base64 string, as specified in RFC 7515 Appendix C
 */
export const b64UrlEncode = (str: string): string =>
  bufferB64UrlEncode(Buffer.from(str, "binary"));

const bufferB64UrlEncode = (b: Buffer): string =>
  b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
