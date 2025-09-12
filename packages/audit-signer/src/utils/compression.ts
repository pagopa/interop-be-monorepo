import { promisify } from "util";
import { gzip } from "zlib";

const gzipAsync = promisify(gzip);

export async function gzipBuffer(data: Uint8Array): Promise<Buffer> {
  return await gzipAsync(data);
}
