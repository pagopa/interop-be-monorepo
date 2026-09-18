import { BffEndpoint, Endpoint } from "../models/index.js";
import { excludeDiscoveredBffEndpoints, readBffEndpoints } from "./bffEnricher.js";
import { getProcessPackages, getRoutersAndOpenapiFiles } from "./filePaths.js";
import { readRouterEndpoints } from "./readProcessRouter.js";

export function readProcess(
  processName: string,
  includeInternalAndMaintenance: boolean,
  includeFrontend: boolean,
  bff?: BffEndpoint[],
): { endpoints: Endpoint[]; bff: BffEndpoint[] } {
  const { routerTsFiles, openapiFile } = getRoutersAndOpenapiFiles(processName);
  let allEndpoints: Endpoint[] = [];
  const bffEndpoints = bff ?? readBffEndpoints(includeFrontend);
  for (const routerFile of routerTsFiles) {
    allEndpoints = allEndpoints.concat(
      readRouterEndpoints(
        routerFile,
        openapiFile,
        processName,
        bffEndpoints,
        includeInternalAndMaintenance,
      ),
    );
  }
  return { endpoints: allEndpoints, bff: bffEndpoints };
}

export function readAllProcesses({
  filterOutBff = false,
  includeInternalAndMaintenance = false,
  includeFrontend = false,
}: {
  filterOutBff?: boolean;
  includeInternalAndMaintenance?: boolean;
  includeFrontend?: boolean;
} = {}) {
  const processNames = getProcessPackages();
  const bff = readBffEndpoints(includeFrontend);
  const output: Record<string, Endpoint[]> = {};
  for (const processName of processNames) {
    output[processName] = readProcess(
      processName,
      includeInternalAndMaintenance,
      includeFrontend,
      bff,
    ).endpoints;
  }
  return {
    output,
    bff: filterOutBff ? excludeDiscoveredBffEndpoints(output, bff) : bff,
  };
}
