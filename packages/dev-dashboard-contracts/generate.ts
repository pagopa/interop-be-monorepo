import { mkdir } from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { generateZodClientFromOpenAPI } from "openapi-zod-client";
import type { OpenAPIObject } from "openapi3-ts";

const main = async (): Promise<void> => {
  await mkdir("./src/generated", { recursive: true });

  // SwaggerParser returns a union that also includes Swagger 2 documents.
  const openApiDoc = (await SwaggerParser.parse(
    "./open-api/dashboardApi.yml"
  )) as OpenAPIObject;

  await generateZodClientFromOpenAPI({
    openApiDoc,
    distPath: "./src/generated/dashboardApi.ts",
    templatePath: "./template.hbs",
    prettierConfig: { trailingComma: "es5" },
    options: {
      withAlias: true,
      shouldExportAllSchemas: true,
      strictObjects: true,
      additionalPropertiesDefaultValue: false,
    },
  });
};

await main();
