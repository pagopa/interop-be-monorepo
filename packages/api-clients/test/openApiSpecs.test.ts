import type { OpenAPIObject } from "openapi3-ts";

import SwaggerParser from "@apidevtools/swagger-parser";
import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const openApiDir = path.resolve(dirname, "../open-api");
const legacySpecFiles: ReadonlySet<string> = new Set([
  "apiGatewayApi.yml",
  "m2mGatewayApi.yml",
]);

const specFiles = readdirSync(openApiDir).filter(
  (file) => /\.ya?ml$/.test(file) && !legacySpecFiles.has(file)
);

const compositionKeywords = ["allOf", "oneOf", "anyOf"];

type SchemaNode = Record<string, unknown>;

const isSchemaNode = (value: unknown): value is SchemaNode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const collectOrphanRequired = (
  node: unknown,
  location: string,
  orphans: string[]
): void => {
  if (!isSchemaNode(node)) {
    return;
  }

  if (compositionKeywords.some((keyword) => keyword in node)) {
    return;
  }

  const required = Array.isArray(node.required) ? node.required : [];
  const properties = isSchemaNode(node.properties) ? node.properties : {};

  const missing = required.filter(
    (field): field is string =>
      typeof field === "string" && !(field in properties)
  );

  missing.forEach((field) => orphans.push(`${location}: ${field}`));

  Object.entries(properties).forEach(([name, property]) =>
    collectOrphanRequired(property, `${location}.${name}`, orphans)
  );

  collectOrphanRequired(node.items, `${location}[]`, orphans);
  collectOrphanRequired(node.additionalProperties, `${location}{}`, orphans);
};

const collectInlineSchemas = (
  container: unknown,
  location: string,
  orphans: string[]
): void => {
  if (!isSchemaNode(container)) {
    return;
  }

  const content = isSchemaNode(container.content) ? container.content : {};

  Object.entries(content).forEach(([mediaType, media]) => {
    if (isSchemaNode(media)) {
      collectOrphanRequired(media.schema, `${location} ${mediaType}`, orphans);
    }
  });
};

const findOrphanRequiredFields = (document: OpenAPIObject): string[] => {
  const orphans: string[] = [];

  Object.entries(document.components?.schemas ?? {}).forEach(([name, schema]) =>
    collectOrphanRequired(schema, name, orphans)
  );

  Object.entries(document.paths ?? {}).forEach(([route, pathItem]) => {
    if (!isSchemaNode(pathItem)) {
      return;
    }

    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!isSchemaNode(operation)) {
        return;
      }

      const endpoint = `${method.toUpperCase()} ${route}`;

      collectInlineSchemas(
        operation.requestBody,
        `${endpoint} request`,
        orphans
      );

      const responses = isSchemaNode(operation.responses)
        ? operation.responses
        : {};

      Object.entries(responses).forEach(([status, response]) =>
        collectInlineSchemas(
          response,
          `${endpoint} response ${status}`,
          orphans
        )
      );
    });
  });

  return orphans;
};

describe("OpenAPI specifications", () => {
  it.each(specFiles)(
    "%s declares every required field among the schema properties",
    async (file) => {
      const document = (await SwaggerParser.parse(
        path.join(openApiDir, file)
      )) as OpenAPIObject;

      expect(findOrphanRequiredFields(document)).toStrictEqual([]);
    }
  );
});
