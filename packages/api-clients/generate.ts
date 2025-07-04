/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable eqeqeq */
/* eslint-disable no-invalid-this */
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable prefer-rest-params */
/* eslint-disable no-eval */
/* eslint-disable sonarjs/prefer-single-boolean-return */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import * as fs from "fs";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIObject } from "openapi3-ts";
import { generateZodClientFromOpenAPI } from "openapi-zod-client";
import Handlebars from "handlebars";

const main = async () => {
  const handlebars = Handlebars.create();
  handlebars.registerHelper({
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and() {
      return Array.prototype.every.call(arguments, Boolean);
    },
    or() {
      return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    },
    pascalcase: (str: string) => {
      if (typeof str !== "string") {
        return "";
      }

      if (str.length === 1) {
        return str.toUpperCase();
      }

      const chopRegex = /^[-_.\W\s]+|[-_.\W\s]+$/g;
      str = str.trim().replace(chopRegex, "");

      const re = /[-_.\W\s]+(\w|$)/g;
      str = str.replace(re, function (_, ch) {
        return ch.toUpperCase();
      });

      return str.charAt(0).toUpperCase() + str.slice(1);
    },
  });

  const dir = "./src/generated";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const apiDocs = fs
    .readdirSync("./open-api", { withFileTypes: true })
    .filter((item) => !item.isDirectory())
    .map((item) => item.name);

  for (const doc of apiDocs) {
    const openApiDoc = (await SwaggerParser.parse(
      `./open-api/${doc}`
    )) as OpenAPIObject;

    const fileName = doc.split(".")[0];
    await generateZodClientFromOpenAPI({
      openApiDoc,
      distPath: `./src/generated/${fileName}.ts`,
      handlebars,
      templatePath:
        fileName === "bffApi" ? "./template-bff.hbs" : "./template.hbs",
      options: {
        isMediaTypeAllowed(mediaType) {
          return (
            mediaType === "application/json" ||
            mediaType === "application/problem+json"
          );
        },
        withAlias: true,
        shouldExportAllSchemas: true,
        shouldExportAllTypes: true,
        groupStrategy: "tag",
        strictObjects: true,
        apiClientName: fileName,
        additionalPropertiesDefaultValue: false,
      },
    });
  }
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
