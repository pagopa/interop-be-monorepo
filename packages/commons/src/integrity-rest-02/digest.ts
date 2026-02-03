import crypto from "crypto";

export type JsonReplacer =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((this: any, key: string, value: any) => any) | null | undefined;

export type JsonSpaces = number | string | undefined;

/**
 * Calculates the digest of a body using the canonical JSON representation.
 *
 * The body can be a string, a buffer, or an object.
 * The body is converted to a string using the canonical JSON representation.
 * The string is then hashed using SHA-256.
 *
 * @param body - The body to calculate the digest from.
 * @param replacer - A function that is called for each property of the object. (optional)
 * @param spaces - A string or number that is used to insert white space into the output JSON string for readability purposes. (optional)
 * @returns The digest of the body.
 */
export function calculateIntegrityRest02DigestFromBody({
  body,
  replacer,
  spaces,
}: {
  body: unknown;
  replacer?: JsonReplacer;
  spaces?: JsonSpaces;
}): string {
  // eslint-disable-next-line functional/no-let
  let payloadBytes: Buffer;
  if (body === null || body === undefined) {
    payloadBytes = Buffer.alloc(0);
  } else if (Buffer.isBuffer(body)) {
    payloadBytes = body;
  } else if (typeof body === "string") {
    payloadBytes = Buffer.from(body);
  } else {
    const json = JSON.stringify(
      body,
      replacer ?? undefined,
      spaces ?? undefined
    );
    payloadBytes = Buffer.from(json);
  }

  return crypto.createHash("sha256").update(payloadBytes).digest("base64url");
}
