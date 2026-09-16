import { readFileSync } from "node:fs";

import { Endpoint, BffEndpoint } from "../models";
import { findServiceFile, findErrorMapperFile } from "./filePaths";
import { findOpenApiOperation, getOpenApiDocument } from "./openApi";
import { getRegexEndpoints } from "./regexHelper";
import { findErrorMappings } from "./errorReader";
import { findServiceMethodLocation } from "./serviceFinder";
import { findBffEndpoints } from "./bffEnricher";

export function readProcessRouter(
  fileName: string,
  yamlFile: string,
  processName: string,
  bffEndpoints: BffEndpoint[],
): Endpoint[] {
  const out: Endpoint[] = [];
  const file = readFileSync(fileName, "utf8");
  const yamlFileContent = getOpenApiDocument(yamlFile);

  for (const match of getRegexEndpoints(file)) {
    const { method, path, serviceName, serviceMethod, mapper, roles } = match;

    const openApi = findOpenApiOperation(path, method, yamlFileContent);
    const mapperFile = findErrorMapperFile(mapper, fileName);
    const serviceFilename = findServiceFile(serviceName, fileName);
    const serviceLocation = findServiceMethodLocation(
      serviceFilename,
      serviceMethod,
    );
    const bff = findBffEndpoints(
      processName,
      openApi?.operationId ?? "NOT FOUND",
      bffEndpoints,
    );
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
        file: serviceFilename,
        startLine: serviceLocation?.startLine,
        endLine: serviceLocation?.endLine,
      },
      mapper: {
        name: mapper ?? "NOT FOUND",
        file: mapperFile, // TODO: If emptyErrorMapper, get module path
        errors: findErrorMappings(mapperFile, mapper),
      },
      roles,
      bffEndpoints: bff,
    });
  }
  return out;
}
