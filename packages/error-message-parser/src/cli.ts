#!/usr/bin/env node
/* eslint-disable no-console */
import { Command } from "@commander-js/extra-typings";
import { writeFileSync } from "node:fs";

import { validateJsonFile, readCsvErrorFile } from "./utils/index.js";

const program = new Command("error-message-parser");

program
  .command("generate")
  .description("Generate the JSON error messages from a CSV file")
  .requiredOption("--csv-input <file>", "CSV file with error messages")
  .requiredOption("--json-output <file>", "Where to write the JSON")
  .option(
    "--languages <list>",
    "Comma-separated list of languages to extract",
    "it,en"
  )
  .action((opts) => {
    const languages = opts.languages
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const { errors, skipped, skippedLines } = readCsvErrorFile(
      opts.csvInput,
      languages
    );
    if (skipped) {
      for (const skippedLine of skippedLines) {
        console.log(skippedLine);
      }
      console.log(`👻 ${skipped} lines skipped`);
      process.exitCode = 1;
      return;
    } else {
      console.log(`✅ Everything looks good!`);
    }
    writeFileSync(opts.jsonOutput, JSON.stringify(errors, undefined, 2));
  });

program
  .command("validate")
  .description("Validate a JSON error messages file against a schema")
  .requiredOption("--json-input <file>", "JSON file to validate")
  .requiredOption("--schema-path <file>", "Schema to validate against")
  .action((opts) => {
    const result = validateJsonFile(opts.jsonInput, opts.schemaPath);
    if (result.valid) {
      console.log(`✅ ${opts.jsonInput} is valid`);
      return;
    }
    console.error(`${opts.jsonInput} is invalid:`);
    result.errors.forEach((e) => console.error(` 💥 ${e}`));
    process.exitCode = 1;
  });

program.parse();
