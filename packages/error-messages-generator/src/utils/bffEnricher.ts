import { findServiceFile, getRoutersAndOpenapiFiles } from "./filePaths";
import { getRegexEndpoints } from "./regexHelper";
import { readFileSync } from "node:fs";
import { BffEndpoint } from "../models";
import { findOpenApiOperation, getOpenApiDocument } from "./openApi";

export function getBffEndpointsByRouter(): BffEndpoint[] {
  const files = getRoutersAndOpenapiFiles("backend-for-frontend");
  const endpointsByRouter: BffEndpoint[] = [];
  const yamlFileContent = getOpenApiDocument(files.openapiFile);
  for (const routerFile of files.routerTsFiles) {
    const file = readFileSync(routerFile, "utf8");
    for (const endpoint of getRegexEndpoints(file)) {
      const { method, path, serviceName, serviceMethod } = endpoint;
      const openApi = findOpenApiOperation(path, method, yamlFileContent);
      endpointsByRouter.push({
        method,
        path,
        fileName: routerFile,
        openApi: {
          operationId: openApi?.operationId ?? "NOT FOUND",
          path: openApi?.path ?? "NOT FOUND",
          fileName: files.openapiFile,
        },
        service: {
          name: serviceName ?? "NOT FOUND",
          method: serviceMethod ?? "NOT FOUND",
          file: findServiceFile(serviceName, routerFile),
        },
      });
    }
  }
  return endpointsByRouter;
}
