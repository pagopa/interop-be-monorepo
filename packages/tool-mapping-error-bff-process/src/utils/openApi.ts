import { readFileSync } from "node:fs";
import { parse } from "yaml";

import type { OpenApiDocument } from "../models/index.js";

export function normalizePath(path: string): string {
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

      // ${eServiceId}
      if (segment.startsWith("${") && segment.endsWith("}")) {
        return "{}";
      }

      return segment.toLowerCase();
    })
    .join("/");
}

export function readOpenApiDocument(openApiFileName: string): OpenApiDocument {
  const file = readFileSync(openApiFileName, "utf8");
  const openApi = parse(file) as OpenApiDocument;
  return openApi;
}

export function findOpenApiOperation(
  routerPath: string,
  method: string,
  openApi: OpenApiDocument
): { operationId: string; path: string } | undefined {
  const normalizedRouterPath = normalizePath(routerPath);

  for (const [openApiPath, pathItem] of Object.entries(openApi.paths ?? {})) {
    if (normalizePath(openApiPath) !== normalizedRouterPath) {
      continue;
    }

    const operation = pathItem[method.toLowerCase()];

    if (!operation) {
      continue;
    }

    if (!operation.operationId) {
      continue;
    }

    return {
      operationId: operation.operationId,
      path: openApiPath,
    };
  }

  return undefined;
}
