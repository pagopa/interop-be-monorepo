export * from "./models/index.js";
export * from "./utils/index.js";

import { readCsvErrorFile } from "./utils/index.js";

const errors = readCsvErrorFile("input.csv", ["it", "en"]);

console.log(JSON.stringify(errors, null, 2));
