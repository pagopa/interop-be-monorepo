// export * from "./models/index.js";
// export * from "./utils/index.js";
import type { Problem } from "pagopa-interop-models";

import { applyErrorCopy, readCsvErrorFile } from "./utils/index.js";

const problem: Problem = {
  type: "expirationDateCannotBeInThePast",
  status: 400,
  title: "expirationDateCannotBeInThePast",
  correlationId: "correlationId",
  detail: "Detail message",
  errors: [
    {
      code: "005-009",
      detail: "Detail message",
    },
  ],
};

console.log("-----------------------");
const errorCopy = readCsvErrorFile("input.csv", ["it", "en"]);
const parsedProblem = applyErrorCopy(
  problem,
  "POST /tenants/:tenantId/attributes/verified/:attributeId",
  errorCopy
);

console.log(JSON.stringify(parsedProblem, null, 2));
console.log("-----------------------");
console.log(JSON.stringify(errorCopy, null, 2));
