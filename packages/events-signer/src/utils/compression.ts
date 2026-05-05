/* eslint-disable functional/immutable-data */
import { Writable } from "stream";
import archiver from "archiver";

export async function compressJson(
  jsonString: string,
  fileName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    const stream = new Writable({
      write(
        chunk: Buffer,
        _encoding: string,
        next: (error?: Error | null) => void
      ): void {
        chunks.push(chunk);
        next();
      },
    });

    archive.on("error", reject);
    stream.on("finish", () => resolve(Buffer.concat(chunks)));

    archive.pipe(stream);
    archive.append(jsonString, { name: fileName });

    void archive.finalize();
  });
}
