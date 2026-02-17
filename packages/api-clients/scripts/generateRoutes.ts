/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIObject } from "openapi3-ts";

const HTTP_METHODS = ["get", "post", "put", "delete", "patch"] as const;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface RouteConfig {
  input: string;
  output: string;
  handlerTypeName: string;
}

const configs: RouteConfig[] = [
  {
    input: "./open-api/notificationConfigApi.yml",
    output: "src/generated/hey-api/notificationConfigApi",
    handlerTypeName: "RouteHandlers",
  },
];

async function generateRoutes(config: RouteConfig): Promise<void> {
  const api = (await SwaggerParser.parse(config.input)) as OpenAPIObject;

  const entries: string[] = [];

  for (const [pathStr, pathItem] of Object.entries(api.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operation = (pathItem as Record<string, any>)[method];
      if (!operation?.operationId) {
        continue;
      }

      const { operationId } = operation as { operationId: string };
      const zodDataName = `z${capitalize(operationId)}Data`;

      const hasBody = !!operation.requestBody;
      const hasPathParams = /\{(\w+)\}/.test(pathStr);

      const schemaParts = [
        ...(hasBody ? [`body: zod.${zodDataName}.shape.body`] : []),
        ...(hasPathParams ? [`params: zod.${zodDataName}.shape.path`] : []),
      ];

      const schemasStr =
        schemaParts.length > 0 ? `{ ${schemaParts.join(", ")} }` : "{}";

      // eslint-disable-next-line functional/immutable-data
      entries.push(
        `  ${operationId}: {\n` +
          `    method: "${method}",\n` +
          `    url: "${pathStr}",\n` +
          `    schemas: ${schemasStr},\n` +
          `  }`
      );
    }
  }

  const output = [
    `// This file is auto-generated — do not edit`,
    `import type { ${config.handlerTypeName} } from "./fastify.gen.js";`,
    `import type { RouteDefinition } from "pagopa-interop-commons";`,
    `import * as zod from "./zod.gen.js";`,
    ``,
    `export const operationRoutes = {`,
    entries.join(",\n"),
    `} as const satisfies Record<keyof ${config.handlerTypeName}, RouteDefinition>;`,
    ``,
  ].join("\n");

  const outputPath = path.join(config.output, "routes.gen.ts");
  fs.writeFileSync(outputPath, output);
  console.log(`Generated ${outputPath}`);
}

async function main(): Promise<void> {
  for (const config of configs) {
    await generateRoutes(config);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
