import { findServiceFile, getRoutersAndOpenapiFiles } from "./filePaths";
import { getRegexEndpoints } from "./regexHelper";
import { readFileSync } from "node:fs";
import { BffEndpoint } from "../models";
import { findOpenApiOperation, getOpenApiDocument } from "./openApi";
import { findProcessCalls } from "./bffProcessCalls";

type ProcessCall = {
  client: string;
  method: string;
};

function findMethodBody(file: string, methodName: string): string | undefined {
  // Find:
  //
  // methodName: async (...) => {
  //
  // We deliberately don't try to parse the parameters.
  const methodStartRegex = new RegExp(`\\b${methodName}\\s*:\\s*async\\b`);

  const methodStartMatch = methodStartRegex.exec(file);

  if (!methodStartMatch) {
    return undefined;
  }

  const start = methodStartMatch.index;

  // Find the first => { after the method name.
  const bodyStartMatch = /=>\s*\{/.exec(file.slice(start));

  if (!bodyStartMatch) {
    return undefined;
  }

  const bodyStart = start + bodyStartMatch.index + bodyStartMatch[0].length - 1;

  let depth = 0;

  for (let i = bodyStart; i < file.length; i++) {
    const char = file[i];

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;

      if (depth === 0) {
        return file.slice(bodyStart + 1, i);
      }
    }
  }

  return undefined;
}

// export function findProcessCalls(
//   serviceFileName: string,
//   serviceMethodName?: string,
// ): ProcessCall[] {
//   if (!serviceMethodName) {
//     return [];
//   }
//   const file = readFileSync(serviceFileName, "utf8");

//   /*
//    * Find the specific service method:
//    *
//    * updateEServiceFlags: async (...) => {
//    *   ...
//    * }
//    *
//    * We capture everything between the opening `{` and the next
//    * service-method definition.
//    */

//   const body = findMethodBody(file, serviceMethodName);

//   if (!body) {
//     return [];
//   }

//   //   console.log(serviceMethodName);
//   //   console.log(body);
//   //   console.log("---------------------------------");

//   /*
//    * Matches:
//    *
//    * catalogProcessClient.updateEServiceDelegationFlags(...)
//    *
//    * tenantProcessClient.tenant.updateTenantDelegatedFeatures(...)
//    */
//   const processCallRegex = /\b(\w+Client(?:\.\w+)*)\.(\w+)\s*\(/g;

//   return [...body.matchAll(processCallRegex)].map(([, client, method]) => ({
//     client,
//     method,
//   }));
// }

export function getBffEndpointsByRouter(): BffEndpoint[] {
  const files = getRoutersAndOpenapiFiles("backend-for-frontend");
  const endpointsByRouter: BffEndpoint[] = [];
  const yamlFileContent = getOpenApiDocument(files.openapiFile);
  for (const routerFile of files.routerTsFiles) {
    const file = readFileSync(routerFile, "utf8");
    for (const endpoint of getRegexEndpoints(file)) {
      const { method, path, serviceName, serviceMethod } = endpoint;
      const openApi = findOpenApiOperation(path, method, yamlFileContent);
      const serviceFile = findServiceFile(serviceName, routerFile);
      const processCalls = findProcessCalls(serviceFile, serviceMethod);
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
          file: serviceFile,
          processes: processCalls.map(({ client, method }) => ({
            process: client,
            method,
          })),
        },
      });
    }
  }
  return endpointsByRouter;
}
