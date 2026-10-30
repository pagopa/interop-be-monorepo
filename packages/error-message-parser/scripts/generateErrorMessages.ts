import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateErrorMessages } from "../src/utils/generateErrorMessages.js";

const input = new URL(
  "../../backend-for-frontend/error-message.csv",
  import.meta.url
);
const outputDirectory = new URL(
  "../../backend-for-frontend/src/generated/",
  import.meta.url
);
const output = new URL("errorMessages.ts", outputDirectory);

const source = generateErrorMessages(fileURLToPath(input));
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(output, source, "utf8");
