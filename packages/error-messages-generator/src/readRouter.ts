import { readAllProcesses } from "./utils/readProcess";

const results = readAllProcesses();

const bff = results.bff;

console.log(
  JSON.stringify(
    bff.filter((r) => r.service.processes.length === 0),
    null,
    2,
  ),
);
console.log(
  `With process: ${bff.filter((r) => r.service.processes.length > 0).length}`,
);
console.log(
  `Without process: ${bff.filter((r) => r.service.processes.length === 0).length}`,
);
const processNames = new Set(
  bff
    .map((r) => r.service.processes)
    .flat()
    .map((p) => p.process),
);
console.log(`Process names: ${Array.from(processNames).join(", ")}`);
console.log(JSON.stringify(results.output, null, 2));
