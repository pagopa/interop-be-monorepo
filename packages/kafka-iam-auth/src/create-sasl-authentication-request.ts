import { SaslAuthenticationRequest } from "kafkajs";
import { Payload } from "./create-payload.js";
import { INT32_SIZE } from "./constants.js";

/** @internal */
export const createSaslAuthenticationRequest = (
  payload: Payload
): SaslAuthenticationRequest => ({
  encode: (): Buffer => {
    const stringifiedPayload = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(stringifiedPayload, "utf8");
    const buf = Buffer.alloc(INT32_SIZE + byteLength);
    buf.writeUInt32BE(byteLength, 0);
    buf.write(stringifiedPayload, INT32_SIZE, byteLength, "utf8");
    return buf;
  },
});
