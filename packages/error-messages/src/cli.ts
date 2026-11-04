import { Command } from "commander";

import { validate } from "./validate/index.js";

const program = new Command();

program
  .name("validate-error-messages")
  .description(
    "Validate the error messages CSV against the generated error messages and the BFF routers"
  )
  .option(
    "--csv <path>",
    "path of the error messages CSV, relative to the repository root",
    "packages/error-messages/error-messages.csv"
  )
  .option(
    "--generated <path>",
    "path of the generated error messages file, relative to the repository root",
    "packages/error-messages/src/generated/errorMessages.ts"
  )
  .action(async (options: { csv: string; generated: string }) => {
    try {
      await validate({
        csvPath: options.csv,
        generatedPath: options.generated,
      });
      console.log("Error messages are valid");
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

await program.parseAsync();
