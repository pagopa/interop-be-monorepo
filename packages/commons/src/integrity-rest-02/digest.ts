import crypto from "crypto";

export function calculateDigestFromBody(
  body: string | Buffer | object | undefined | null
): string {
  // eslint-disable-next-line functional/no-let
  let payloadBytes: Buffer;
  if (Buffer.isBuffer(body)) {
    payloadBytes = body;
  } else if (typeof body === "object") {
    payloadBytes = Buffer.from(JSON.stringify(body));
  } else {
    payloadBytes = Buffer.from(String(body));
  }

  return crypto.createHash("sha256").update(payloadBytes).digest("base64");
}
