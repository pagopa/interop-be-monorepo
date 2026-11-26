/* eslint-disable functional/immutable-data */
import { auditCapture } from "./auditCapture.js";

export const initProducer = async () => ({
  send: async (payload: { messages: Array<{ value: string }> }) => {
    payload.messages.forEach(({ value }) => {
      auditCapture.entries.push(JSON.parse(value) as Record<string, unknown>);
    });
    return [{ errorCode: 0 }];
  },
});
