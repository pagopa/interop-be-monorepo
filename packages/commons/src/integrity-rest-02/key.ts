// Throw-me-away
import { readFileSync } from "fs";
import { join } from "path";

export function readBase64FromPrivateKeyFile(privateKey: string): string {
  const pemFile = readFileSync(
    join(process.cwd(), `${privateKey}.rs.priv`),
    "utf8"
  );

  // Encode PEM as base64 (for config / env / JSON transport)
  return Buffer.from(pemFile, "utf8").toString("base64");
}
