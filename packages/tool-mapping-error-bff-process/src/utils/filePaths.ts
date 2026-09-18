import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

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

export function toCamelCase(str: string): string {
  if (str === "backend-for-frontend") {
    return "bff";
  }
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export function getPackageFolder(): string {
  return resolve(dirname(__filename), "..", "..", "..");
}

export function getFrontendFolder(): string {
  return join(getPackageFolder(), "..", "..", "pdnd-interop-frontend");
}

function frontendExists(): boolean {
  return existsSync(getFrontendFolder());
}

export function getFrontendSrcFolder(): string {
  return join(getFrontendFolder(), "src");
}

export function getFrontendApiFolder(): string {
  return join(getFrontendSrcFolder(), "api");
}

export function getFrontendServiceFileList(): string[] {
  if (!frontendExists()) {
    return [];
  }
  const apiFolder = getFrontendApiFolder();
  // iterate the folders
  const serviceFiles: string[] = [];
  const folders = readdirSync(apiFolder, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory(),
  );

  for (const folder of folders) {
    const folderPath = join(apiFolder, folder.name);
    const tsFiles = readdirSync(folderPath)
      .filter((file) => file.endsWith("services.ts"))
      .map((file) => join(folderPath, file));
    serviceFiles.push(...tsFiles);
  }

  return serviceFiles;
}

export function getFrontendTypescriptFiles(): string[] {
  if (!frontendExists()) {
    return [];
  }
  const srcFolder = getFrontendSrcFolder();
  const tsFiles: string[] = [];

  function visit(folder: string): void {
    const entries = readdirSync(folder, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(folder, entry.name);

      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      ) {
        tsFiles.push(fullPath);
      }
    }
  }

  visit(srcFolder);

  return tsFiles;
}

export function getRoutersAndOpenapiFiles(processName: string) {
  const packagesFolder = getPackageFolder();
  const routerFolder = join(
    packagesFolder,
    processName === "backend-for-frontend"
      ? "backend-for-frontend"
      : `${processName}-process`,
    "src",
    "routers",
  );
  const routerTsFiles = readdirSync(routerFolder).filter((file) =>
    file.endsWith(".ts"),
  );

  const openapiFolder = join(packagesFolder, "api-clients", "open-api");
  const processApiFile = readdirSync(openapiFolder).find((file) =>
    file.endsWith(`${toCamelCase(processName)}Api.yml`),
  );

  if (!processApiFile) {
    throw new Error(`OpenAPI file for process "${processName}" not found`);
  }

  return {
    routerTsFiles: routerTsFiles.map((file) => join(routerFolder, file)),
    openapiFile: join(openapiFolder, processApiFile),
  };
}

export function getProcessPackages(): string[] {
  const packagesFolder = getPackageFolder();

  return readdirSync(packagesFolder, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.endsWith("-process") &&
        entry.name !== "tool-mapping-error-bff-process",
    )
    .map((entry) => entry.name.slice(0, -"-process".length));
}
