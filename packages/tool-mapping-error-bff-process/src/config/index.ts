import { parseArgs } from "node:util";

import { Args } from "../models/index.js";

export function getCliArgs(): Args {
  // Implementation to parse CLI arguments and return them as an Args object
  // This is a placeholder and should be replaced with actual argument parsing logic

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
      "include-frontend": {
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
  return {
    process: values.process,
    output: values.output,
    filterBff: values["filter-bff"] ?? false,
    showBff: values["show-bff"] ?? false,
    prettyPrint: values["pretty-print"] ?? false,
    includeInternalAndMaintenance:
      values["include-internal-and-maintenance"] ?? false,
    includeFrontend: values["include-frontend"] ?? false,
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
    offset: values.offset ? parseInt(values.offset, 10) : undefined,
  };
}
