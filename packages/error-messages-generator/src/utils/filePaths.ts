import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function resolveImportPath(
  importPath: string,
  routerFileName: string,
): string {
  const resolved = resolve(dirname(routerFileName), importPath);

  const candidates = [
    resolved,
    resolved.replace(/\.js$/, ".ts"),
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}/index.ts`,
  ];

  const existing = candidates.find(existsSync);

  return existing ?? resolved;
}

export function findServiceFile(
  serviceName: string | undefined,
  routerFileName: string,
): string {
  if (!serviceName) {
    return "NOT FOUND";
  }

  const file = readFileSync(routerFileName, "utf8");

  // Find:
  //
  // catalogService: CatalogService
  //
  // and capture CatalogService.
  const parameterRegex = new RegExp(`\\b${serviceName}\\s*:\\s*(\\w+)`);

  const parameterMatch = file.match(parameterRegex);

  if (!parameterMatch) {
    return "NOT FOUND";
  }

  const serviceType = parameterMatch[1];

  // Find:
  //
  // import { CatalogService } from "../services/catalogService.js";
  //
  const importRegex = new RegExp(
    `import\\s*\\{[^}]*\\b${serviceType}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`,
  );

  const importMatch = file.match(importRegex);

  if (!importMatch) {
    return "NOT FOUND";
  }

  return resolveImportPath(importMatch[1], routerFileName);
}

export function findErrorMapperFile(
  mapperName: string | undefined,
  routerFileName: string,
): string {
  if (!mapperName) {
    return "NOT FOUND";
  }

  const file = readFileSync(routerFileName, "utf8");

  const importRegex = new RegExp(
    `import\\s*\\{[^}]*\\b${mapperName}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`,
  );

  const match = file.match(importRegex);

  if (!match) {
    return "NOT FOUND";
  }

  return resolveImportPath(match[1], routerFileName);
}
