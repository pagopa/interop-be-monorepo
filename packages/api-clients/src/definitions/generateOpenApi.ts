import * as fs from "fs";
import * as path from "path";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  type ResponseConfig,
} from "@asteasolutions/zod-to-openapi";
import { z, ZodType, ZodVoid } from "zod";
import YAML from "yaml";
import type { EndpointDefinition } from "pagopa-interop-commons";

extendZodWithOpenApi(z);

type SchemaEntry = {
  name: string;
  schema: ZodType;
};

type EndpointsToOpenApiOptions = {
  title: string;
  description: string;
  version: string;
  tags: Array<{
    name: string;
    description: string;
    externalDocs?: { description: string; url: string };
  }>;
  security?: Array<Record<string, string[]>>;
  securitySchemes?: Record<string, unknown>;
  servers?: Array<{ url: string; description: string }>;
  endpoints: ReadonlyArray<EndpointDefinition>;
  schemas: SchemaEntry[];
  outputPath: string;
};

function endpointPathToOpenApi(p: string): string {
  return p.replace(/:(\w+)/g, "{$1}");
}

export function endpointsToOpenApi(options: EndpointsToOpenApiOptions): void {
  const registry = new OpenAPIRegistry();

  for (const { name, schema } of options.schemas) {
    registry.register(name, schema);
  }

  for (const endpoint of options.endpoints) {
    const openApiPath = endpointPathToOpenApi(endpoint.path);

    const params = (endpoint.parameters ?? []).filter((p) => p.type !== "Body");
    const bodyParam = (endpoint.parameters ?? []).find(
      (p) => p.type === "Body"
    );

    const request: Record<string, unknown> = {};

    const pathParams = params.filter((p) => p.type === "Path");
    const queryParams = params.filter((p) => p.type === "Query");
    const headerParams = params.filter((p) => p.type === "Header");

    if (pathParams.length > 0) {
      request.params = z.object(
        Object.fromEntries(pathParams.map((p) => [p.name, p.schema]))
      );
    }
    if (queryParams.length > 0) {
      request.query = z.object(
        Object.fromEntries(queryParams.map((p) => [p.name, p.schema]))
      );
    }
    if (headerParams.length > 0) {
      request.headers = z.object(
        Object.fromEntries(headerParams.map((p) => [p.name, p.schema]))
      );
    }

    if (bodyParam) {
      request.body = {
        content: {
          "application/json": {
            schema: bodyParam.schema,
          },
        },
        required: true,
        description: bodyParam.description,
      };
    }

    const responses: Record<string, ResponseConfig> = {};

    if (endpoint.response && !(endpoint.response instanceof ZodVoid)) {
      responses["200"] = {
        description: endpoint.description ?? "Successful response",
        content: {
          "application/json": {
            schema: endpoint.response,
          },
        },
      };
    } else {
      responses["204"] = {
        description: endpoint.description ?? "No content",
      };
    }

    if (endpoint.errors) {
      for (const error of endpoint.errors) {
        const status = String(error.status);
        if (!responses[status]) {
          responses[status] = {
            description:
              (error as { description?: string }).description ??
              `Error ${status}`,
            content: {
              "application/problem+json": {
                schema: error.schema,
              },
            },
          };
        }
      }
    }

    registry.registerPath({
      method: endpoint.method as "get" | "post" | "put" | "patch" | "delete",
      path: openApiPath,
      operationId: endpoint.alias,
      summary: endpoint.description,
      description: endpoint.description,
      tags: ["process"],
      security: [{ bearerAuth: [] }],
      request,
      responses,
    });
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const doc = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: options.title,
      description: options.description,
      version: options.version,
      contact: {
        name: "API Support",
        url: "http://www.example.com/support",
        email: "support@example.com",
      },
      termsOfService: "http://swagger.io/terms/",
      "x-api-id": "an x-api-id" as unknown as undefined,
      "x-summary": "an x-summary" as unknown as undefined,
    },
    servers: options.servers ?? [
      { url: "/", description: options.description },
    ],
    security: options.security ?? [{ bearerAuth: [] }],
    tags: options.tags,
  });

  if (options.securitySchemes && doc.components) {
    // eslint-disable-next-line functional/immutable-data
    doc.components.securitySchemes =
      options.securitySchemes as typeof doc.components.securitySchemes;
  }

  const yamlStr = YAML.stringify(doc, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  });

  const outputDir = path.dirname(options.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(options.outputPath, yamlStr);
}
