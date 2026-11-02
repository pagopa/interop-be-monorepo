import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type RouterEndpoint = {
  method: string;
  path: string;
};

export function extractRouterEndpoints(file: string): string[] {
  const endpointRegex =
    /\.(get|post|put|patch|delete|options|head|trace)\(\s*"([^"]+)"([\s\S]*?)(?=\n\s*\.(?:get|post|put|patch|delete|options|head|trace)\(|$)/g;
  const fileContent = readFileSync(file, "utf-8");
  const out: RouterEndpoint[] = [];
  for (const match of fileContent.matchAll(endpointRegex)) {
    const [, method, path] = match;

    out.push({
      method: method.trim().toUpperCase(),
      path: path.trim(),
    });
  }
  return out.map((ep) => `${ep.method} ${ep.path}`);
}

export function getRouterFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /Router\.ts$/.test(entry.name))
    .map((entry) => join(folder, entry.name));
}

export function extractRouterEndpointsFromFolder(folder: string): string[] {
  const out: string[] = [];
  for (const routerFile of getRouterFiles(folder)) {
    out.push(...extractRouterEndpoints(routerFile));
  }
  return out;
}
