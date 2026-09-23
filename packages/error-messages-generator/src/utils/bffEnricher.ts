import { match } from "ts-pattern";
import { findServiceFile, getRoutersAndOpenapiFiles } from "./filePaths";
import { extractRouterEndpoints } from "./regexHelper";
import { readFileSync } from "node:fs";
import {
  BffEndpoint,
  Endpoint,
  FrontendServiceFileWithStackCalls,
} from "../models";
import { findOpenApiOperation, readOpenApiDocument } from "./openApi";
import { findProcessCalls } from "./bffProcessCalls";
import { findServiceMethodLocation } from "./serviceFinder";
import { findFunctionCalls, findPathInService } from "./frontendFinder";

// Process names: inAppNotificationManagerClient,
//       selfcareV2InstitutionClient, selfcareV2UserClient,
function resolveProcessName(client: string): string {
  return match(client)
    .with("agreementProcessClient", () => "agreement")
    .with("attributeClient", () => "attribute-registry")
    .with("tenantProcessClient.tenant", () => "tenant")
    .with("catalogProcessClient", () => "catalog")
    .with(
      "delegationProcessClient.delegation",
      "delegationClients.delegation",
      "delegationClients.producer",
      "delegationClients.consumer",
      () => "delegation",
    )
    .with(
      "eserviceTemplateProcessClient",
      "eserviceTemplateClient",
      () => "eservice-template",
    )
    .with(
      "authorizationClient.client",
      "authorizationClient.producerKeychain",
      () => "authorization",
    )
    .with(
      "purposeTemplateProcessClient",
      "purposeTemplateClient",
      () => "purpose-template",
    )
    .with("purposeProcessClient", () => "purpose")
    .with("notificationConfigClient", () => "notification-config")
    .with(
      "tenantProcessClient.tenantAttribute",
      "tenantClient.tenant",
      () => "tenant",
    )
    .otherwise(() => client);
}

export function readBffEndpoints(includeFrontend: boolean): BffEndpoint[] {
  const files = getRoutersAndOpenapiFiles("backend-for-frontend");
  const endpointsByRouter: BffEndpoint[] = [];
  const yamlFileContent = readOpenApiDocument(files.openapiFile);
  for (const routerFile of files.routerTsFiles) {
    const file = readFileSync(routerFile, "utf8");
    for (const endpoint of extractRouterEndpoints(file)) {
      const { method, path, serviceName, serviceMethod } = endpoint;
      const openApi = findOpenApiOperation(path, method, yamlFileContent);
      const serviceFile = findServiceFile(serviceName, routerFile);
      const processCalls = findProcessCalls(serviceFile, serviceMethod);
      const serviceLocation = findServiceMethodLocation(
        serviceFile,
        serviceMethod,
      );

      let frontendServiceWithStackCalls:
        | FrontendServiceFileWithStackCalls
        | undefined;
      if (includeFrontend) {
        const frontendService = findPathInService(path, method);
        if (frontendService) {
          const calls = findFunctionCalls(
            frontendService.file,
            frontendService.functionName,
          );
          frontendServiceWithStackCalls = {
            fileName: frontendService.file,
            functionName: frontendService.functionName,
            stackCalls: calls.map(({ file, lineNumber }) => ({
              fileName: file,
              lineNumber,
            })),
          };
        }
      }
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
          startLine: serviceLocation?.startLine,
          endLine: serviceLocation?.endLine,
          processes: processCalls.map(({ client, method }) => ({
            process: resolveProcessName(client),
            method,
          })),
        },
        frontendServiceFile: frontendServiceWithStackCalls,
      });
    }
  }
  return endpointsByRouter;
}

export function findBffEndpointsForProcess(
  processName: string,
  operationId: string,
  endpoints: BffEndpoint[],
): BffEndpoint[] {
  return endpoints.filter(
    (endpoint) =>
      endpoint.service.processes.some(
        (process) => process.process === processName,
      ) && endpoint.openApi.operationId === operationId,
  );
}

export function excludeDiscoveredBffEndpoints(
  processEndpoints: Record<string, Endpoint[]>,
  bffEndpoints: BffEndpoint[],
): BffEndpoint[] {
  return bffEndpoints.filter(
    (bffEndpoint) =>
      !processEndpoints[bffEndpoint.service.processes[0]?.process]?.some(
        (processEndpoint) =>
          processEndpoint.path === bffEndpoint.path &&
          processEndpoint.method === bffEndpoint.method,
      ),
  );
}
