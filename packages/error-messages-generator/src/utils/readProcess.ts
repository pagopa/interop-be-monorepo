import { BffEndpoint, Endpoint } from "../models";
import {
  filterOutAlreadyFoundBffEndpoints,
  getBffEndpointsByRouter,
} from "./bffEnricher";
import { getProcessPackages, getRoutersAndOpenapiFiles } from "./filePaths";
import { readProcessRouter } from "./readProcessRouter";

export function readProcess(
  processName: string,
  bff?: BffEndpoint[],
): { endpoints: Endpoint[]; bff: BffEndpoint[] } {
  const { routerTsFiles, openapiFile } = getRoutersAndOpenapiFiles(processName);
  let allEndpoints: Endpoint[] = [];
  const bffEndpoints = bff ?? getBffEndpointsByRouter();
  for (const routerFile of routerTsFiles) {
    allEndpoints = allEndpoints.concat(
      readProcessRouter(routerFile, openapiFile, processName, bffEndpoints),
    );
  }
  return { endpoints: allEndpoints, bff: bffEndpoints };
}

export function readAllProcesses(filterOutBff: boolean) {
  const processNames = getProcessPackages();
  const bff = getBffEndpointsByRouter();
  const output: Record<string, Endpoint[]> = {};
  for (const processName of processNames) {
    output[processName] = readProcess(processName, bff).endpoints;
  }
  return {
    output,
    bff: filterOutBff ? filterOutAlreadyFoundBffEndpoints(output, bff) : bff,
  };
}
