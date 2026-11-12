import { Command } from "commander";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateErrorMessages } from "./utils/generateErrorMessages.js";
import { validate } from "./validate/index.js";

const program = new Command("error-messages-cli");

const input = new URL("../error-messages.csv", import.meta.url);
const outputDirectory = new URL("../src/generated/", import.meta.url);
const output = new URL("errorMessages.ts", outputDirectory);

program
  .command("generate")
  .description("Generates the error messages TypeScript file from the CSV")
  .action(async () => {
    const source = generateErrorMessages(fileURLToPath(input));
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(output, source, "utf8");
  });

program
  .command("validate")
  .description(
    "Validate the error messages CSV against the generated error messages and the BFF routers"
  )
  .action(async () => {
    try {
      await validate({
        csvPath: fileURLToPath(input),
        generatedPath: fileURLToPath(output),
      });
      console.log("Error messages are valid");
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

await program.parseAsync();
