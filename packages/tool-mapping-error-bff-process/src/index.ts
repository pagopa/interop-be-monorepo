import { writeFileSync } from "node:fs";
import { getCliArgs } from "./config/index.js";
import { readAllProcesses } from "./utils/index.js";

function main() {
  const {
    process,
    filterBff,
    includeInternalAndMaintenance,
    includeFrontend,
    showBff,
    limit,
    offset,
    prettyPrint,
    output: outputPath,
  } = getCliArgs();
  const { output, bff } = readAllProcesses({
    filterOutBff: filterBff,
    includeInternalAndMaintenance: includeInternalAndMaintenance,
    includeFrontend: includeFrontend,
  });

  let filteredOutput = {
    output: process ? { [process]: output[process] ?? [] } : output,
    bff: showBff ? bff : [],
  };

  if (process && limit !== undefined) {
    filteredOutput.output[process] = filteredOutput.output[process].slice(
      offset ?? 0,
      (offset ?? 0) + limit,
    );
  }

  const jsonOutput = JSON.stringify(filteredOutput, null, prettyPrint ? 2 : 0);

  console.log(jsonOutput);

  if (outputPath) {
    writeFileSync(outputPath, jsonOutput);
  }
}

main();
