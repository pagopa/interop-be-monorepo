import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { OpenApiDocument } from "../models";

function normalizePath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      // :eServiceId
      if (segment.startsWith(":")) {
        return "{}";
      }

      // {eServiceId}
      if (segment.startsWith("{") && segment.endsWith("}")) {
        return "{}";
      }

      return segment.toLowerCase();
    })
    .join("/");
}

export function findOpenApiOperation(
  routerPath: string,
  method: string,
  openApiFileName: string,
): { operationId: string; path: string } | undefined {
  const file = readFileSync(openApiFileName, "utf8");
  const openApi = parse(file) as OpenApiDocument;

  const normalizedRouterPath = normalizePath(routerPath);

  for (const [openApiPath, pathItem] of Object.entries(openApi.paths ?? {})) {
    if (normalizePath(openApiPath) !== normalizedRouterPath) {
      continue;
    }

    const operation = pathItem[method.toLowerCase()];

    if (!operation) {
      continue;
    }

    return {
      operationId: operation.operationId ?? "NOT FOUND",
      path: openApiPath,
    };
  }

  return undefined;
}
