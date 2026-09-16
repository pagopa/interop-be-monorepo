import { readFileSync } from "node:fs";

import { Endpoint } from "./models";
import { findServiceFile, findErrorMapperFile } from "./utils/filePaths";
import { findOpenApiOperation } from "./utils/openApi";
import { getRegexEndpoints } from "./utils/regexHelper";

function processRouter(fileName: string, yamlFile: string): Endpoint[] {
  const out: Endpoint[] = [];
  const file = readFileSync(fileName, "utf8");

  for (const match of getRegexEndpoints(file)) {
    const { method, path, serviceName, serviceMethod, mapper, roles } = match;

    const openApi = findOpenApiOperation(path, method, yamlFile);
    out.push({
      method,
      path,
      fileName,
      openApi: {
        operationId: openApi?.operationId ?? "NOT FOUND",
        path: openApi?.path ?? "NOT FOUND",
        fileName: yamlFile,
      },
      service: {
        name: serviceName ?? "NOT FOUND",
        method: serviceMethod ?? "NOT FOUND",
        file: findServiceFile(serviceName, fileName),
      },
      mapper: {
        name: mapper ?? "NOT FOUND",
        file: findErrorMapperFile(mapper, fileName),
      },
      roles,
    });
  }
  return out;
}

const router = processRouter(process.argv[2], process.argv[3]);
console.log(JSON.stringify(router, null, 2));
