import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateErrorMessages } from "./utils/generateErrorMessages.js";

const input = new URL(
  "../../backend-for-frontend/error-messages.csv",
  import.meta.url
);
const outputDirectory = new URL(
  "../src/",
  import.meta.url
);
const output = new URL("index.ts", outputDirectory);

const source = generateErrorMessages(fileURLToPath(input));
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(output, source, "utf8");
