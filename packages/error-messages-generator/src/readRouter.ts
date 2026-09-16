import { readAllProcesses } from "./utils/readProcess";

const results = readAllProcesses();

console.log(JSON.stringify(results, null, 2));
