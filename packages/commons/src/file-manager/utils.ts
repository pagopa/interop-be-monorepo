import { Readable } from "stream";

export const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks = [];

  for await (const chunk of stream) {
    /* eslint-disable functional/immutable-data */
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

export const streamToString = async (stream: Readable): Promise<string> => {
  const buffer = await streamToBuffer(stream);
  return buffer.toString();
};
