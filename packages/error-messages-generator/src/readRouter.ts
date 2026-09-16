import { readFileSync } from "node:fs";

import { Endpoint } from "./models";
import {
  findServiceFile,
  findErrorMapperFile,
  getRoutersAndOpenapiFiles,
} from "./utils/filePaths";
import { findOpenApiOperation, getOpenApiDocument } from "./utils/openApi";
import { getRegexEndpoints } from "./utils/regexHelper";
import { findErrorMappings } from "./utils/errorReader";
import { getBffEndpointsByRouter } from "./utils/bffEnricher";

function processRouter(fileName: string, yamlFile: string): Endpoint[] {
  const out: Endpoint[] = [];
  const file = readFileSync(fileName, "utf8");
  const yamlFileContent = getOpenApiDocument(yamlFile);

  for (const match of getRegexEndpoints(file)) {
    const { method, path, serviceName, serviceMethod, mapper, roles } = match;

    const openApi = findOpenApiOperation(path, method, yamlFileContent);
    const mapperFile = findErrorMapperFile(mapper, fileName);
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
        file: mapperFile, // TODO: If emptyErrorMapper, get module path
        errors: findErrorMappings(mapperFile, mapper),
      },
      roles,
    });
  }
  return out;
}

function processProcess(processName: string): Endpoint[] {
  const { routerTsFiles, openapiFile } = getRoutersAndOpenapiFiles(processName);
  let allEndpoints: Endpoint[] = [];
  for (const routerFile of routerTsFiles) {
    allEndpoints = allEndpoints.concat(processRouter(routerFile, openapiFile));
  }
  return allEndpoints;
}

// const router = processProcess(process.argv[2]);
const router = getBffEndpointsByRouter();
console.log(JSON.stringify(router, null, 2));
