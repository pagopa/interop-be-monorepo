import { Readable } from "stream";
import crypto from "crypto";

export async function calculateChecksum(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

export async function isPdf(doc: File) {
  if (doc.size < 5) return false;

  const header = doc.slice(0, 5);
  const buffer = await header.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];
  for (let i = 0; i < PDF_MAGIC_BYTES.length; ++i) {
    if (PDF_MAGIC_BYTES[i] !== bytes[i]) return false;
  }

  return true;
}
