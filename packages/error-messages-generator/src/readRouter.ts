import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

const ErrorMapper = z.object({
  name: z.string(),
  file: z.string(),
});

type ErrorMapper = z.infer<typeof ErrorMapper>;

const Service = z.object({
  name: z.string(),
  method: z.string(),
  file: z.string(),
});

type Service = z.infer<typeof Service>;

const Endpoint = z.object({
  method: z.string(),
  path: z.string(),
  fileName: z.string(),
  service: Service,
  mapper: ErrorMapper,
  roles: z.array(z.string()),
});

type Endpoint = z.infer<typeof Endpoint>;

function resolveImportPath(importPath: string, routerFileName: string): string {
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

function findServiceFile(
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

function findErrorMapperFile(
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

function processRouter(fileName: string): Endpoint[] {
  const out: Endpoint[] = [];
  const file = readFileSync(fileName, "utf8");

  const endpointRegex =
    /\.(get|post|put|patch|delete|options|head|trace)\(\s*"([^"]+)"([\s\S]*?)(?=\n\s*\.(?:get|post|put|patch|delete|options|head|trace)\(|$)/g;

  for (const match of file.matchAll(endpointRegex)) {
    const [, method, path, body] = match;

    const serviceMatch = body.match(/([a-zA-Z]\w*Service)\.(\w+)\s*\(/);

    const mapperMatch = body.match(/makeApiProblem\(\s*[\s\S]*?,\s*(\w+),/);

    const rolesMatch = body.match(
      /validateAuthorization\(\s*ctx,\s*\[([^\]]+)\]/,
    );

    const roles = rolesMatch
      ? rolesMatch[1]
          .split(",")
          .map((role) => role.trim())
          .join(", ")
      : "";
    out.push({
      method,
      path,
      fileName,
      service: {
        name: serviceMatch?.[1] ?? "NOT FOUND",
        method: serviceMatch?.[2] ?? "NOT FOUND",
        file: findServiceFile(serviceMatch?.[1], fileName),
      },
      mapper: {
        name: mapperMatch?.[1] ?? "NOT FOUND",
        file: findErrorMapperFile(mapperMatch?.[1], fileName),
      },
      roles: roles ? roles.split(", ").map((role) => role.trim()) : [],
    });
  }
  return out;
}

const router = processRouter(process.argv[2]);
console.log(JSON.stringify(router, null, 2));
