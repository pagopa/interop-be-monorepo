import crypto from "crypto";

function canonicalStringify(value: unknown): string {
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  // eslint-disable-next-line functional/immutable-data
  const keys = Object.keys(obj).sort();

  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`
  );

  return `{${entries.join(",")}}`;
}

export function calculateIntegrityRest02DigestFromBody(body: unknown): string {
  // eslint-disable-next-line functional/no-let
  let payloadBytes: Buffer;
  if (body === null || body === undefined) {
    payloadBytes = Buffer.alloc(0);
  } else if (Buffer.isBuffer(body)) {
    payloadBytes = body;
  } else if (typeof body === "string") {
    payloadBytes = Buffer.from(body);
  } else {
    payloadBytes = Buffer.from(canonicalStringify(body));
  }

  return crypto.createHash("sha256").update(payloadBytes).digest("base64url");
}
