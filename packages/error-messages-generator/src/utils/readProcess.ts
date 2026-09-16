import { BffEndpoint, Endpoint } from "../models";
import {
  excludeDiscoveredBffEndpoints,
  readBffEndpoints,
} from "./bffEnricher";
import { getProcessPackages, getRoutersAndOpenapiFiles } from "./filePaths";
import { readRouterEndpoints } from "./readProcessRouter";

export function readProcess(
  processName: string,
  bff?: BffEndpoint[],
): { endpoints: Endpoint[]; bff: BffEndpoint[] } {
  const { routerTsFiles, openapiFile } = getRoutersAndOpenapiFiles(processName);
  let allEndpoints: Endpoint[] = [];
  const bffEndpoints = bff ?? readBffEndpoints();
  for (const routerFile of routerTsFiles) {
    allEndpoints = allEndpoints.concat(
      readRouterEndpoints(routerFile, openapiFile, processName, bffEndpoints),
    );
  }
  return { endpoints: allEndpoints, bff: bffEndpoints };
}

export function readAllProcesses({
  filterOutBff = false,
}: { filterOutBff?: boolean } = {}) {
  const processNames = getProcessPackages();
  const bff = readBffEndpoints();
  const output: Record<string, Endpoint[]> = {};
  for (const processName of processNames) {
    output[processName] = readProcess(processName, bff).endpoints;
  }
  return {
    output,
    bff: filterOutBff ? excludeDiscoveredBffEndpoints(output, bff) : bff,
  };
}
