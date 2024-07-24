import { Readable } from "node:stream";

export const streamToString = async (stream: Readable): Promise<string> => {
  const chunks = [];

  for await (const chunk of stream) {
    /* eslint-disable functional/immutable-data */
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
};
