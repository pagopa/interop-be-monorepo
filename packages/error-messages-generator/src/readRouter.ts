import { parseArgs } from "node:util";
import { readAllProcesses } from "./utils/readProcess";
import { writeFileSync } from "node:fs";

const { values } = parseArgs({
  options: {
    process: {
      type: "string",
    },
    output: {
      type: "string",
    },
    "filter-bff": {
      type: "boolean",
    },
    "show-bff": {
      type: "boolean",
    },
    "pretty-print": {
      type: "boolean",
    },
    "include-internal-and-maintenance": {
      type: "boolean",
    },
  },
});

const processName = values.process;
const filterBff = values["filter-bff"] ?? false;
const showBff = values["show-bff"] ?? false;
const prettyPrint = values["pretty-print"] ?? false;
const includeInternalAndMaintenance =
  values["include-internal-and-maintenance"] ?? false;
const outputPath = values.output;

const { output, bff } = readAllProcesses({
  filterOutBff: filterBff,
  includeInternalAndMaintenance: includeInternalAndMaintenance,
});

const jsonOutput = JSON.stringify(
  {
    output: processName ? { [processName]: output[processName] ?? [] } : output,
    bff: showBff ? bff : [],
  },
  null,
  prettyPrint ? 2 : 0,
);

console.log(jsonOutput);

if (outputPath) {
  writeFileSync(outputPath, jsonOutput);
}
