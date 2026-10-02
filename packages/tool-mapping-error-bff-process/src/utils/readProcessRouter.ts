import { readFileSync } from "node:fs";

import { Endpoint, BffEndpoint } from "../models/index.js";
import { findBffEndpointsForProcess } from "./bffEnricher.js";
import { findErrorMappings } from "./errorReader.js";
import { findServiceFile, findErrorMapperFile } from "./filePaths.js";
import { findOpenApiOperation, readOpenApiDocument } from "./openApi.js";
import { extractRouterEndpoints } from "./routerEndpoint.js";
import { findServiceMethodLocation } from "./serviceFinder.js";

export function readRouterEndpoints(
  fileName: string,
  yamlFile: string,
  processName: string,
  bffEndpoints: BffEndpoint[],
  includeInternalAndMaintenance: boolean
): Endpoint[] {
  const out: Endpoint[] = [];
  const file = readFileSync(fileName, "utf8");
  const yamlFileContent = readOpenApiDocument(yamlFile);

  for (const match of extractRouterEndpoints(file)) {
    const { method, path, serviceName, serviceMethod, mapper, roles } = match;

    const openApi = findOpenApiOperation(path, method, yamlFileContent);
    const mapperFile = findErrorMapperFile(mapper, fileName);
    const serviceFilename = findServiceFile(serviceName, fileName);
    const serviceLocation = findServiceMethodLocation(
      serviceFilename,
      serviceMethod
    );
    const bff = findBffEndpointsForProcess(
      processName,
      openApi?.operationId ?? "NOT FOUND",
      bffEndpoints
    );
    if (
      !includeInternalAndMaintenance &&
      (path.includes("/internal") || path.includes("/maintenance"))
    ) {
      continue;
    }
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
