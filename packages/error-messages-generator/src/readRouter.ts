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
    limit: {
      type: "string",
    },
    offset: {
      type: "string",
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
const limit = values.limit ? parseInt(values.limit, 10) : undefined;
const offset = values.offset ? parseInt(values.offset, 10) : undefined;

const { output, bff } = readAllProcesses({
  filterOutBff: filterBff,
  includeInternalAndMaintenance: includeInternalAndMaintenance,
});

let filteredOutput = {
  output: processName ? { [processName]: output[processName] ?? [] } : output,
  bff: showBff ? bff : [],
};

if (processName && limit !== undefined) {
  filteredOutput.output[processName] = filteredOutput.output[processName].slice(
    offset ?? 0,
    (offset ?? 0) + limit,
  );
}

const jsonOutput = JSON.stringify(filteredOutput, null, prettyPrint ? 2 : 0);

console.log(jsonOutput);

if (outputPath) {
  writeFileSync(outputPath, jsonOutput);
}
