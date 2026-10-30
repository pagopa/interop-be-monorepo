import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

export function getRootPath(): string {
  return resolve(join(dirname(__filename), "..", "..", "..", ".."));
}
