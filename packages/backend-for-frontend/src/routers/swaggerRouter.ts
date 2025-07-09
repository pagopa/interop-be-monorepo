import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { zodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

const BFF_API_SPEC_FILE_NAME: string = "bffApi.yml";

const pkgUrl = import.meta.resolve("pagopa-interop-api-clients");
const pkgDir = path.dirname(fileURLToPath(pkgUrl));

const yamlPath = path.join(
  path.dirname(pkgDir),
  "open-api",
  BFF_API_SPEC_FILE_NAME
);

const yamlSpecFile = await fs.readFile(yamlPath, "utf8");
const swaggerDocument = YAML.parse(yamlSpecFile);

const swaggerRouter = zodiosRouter(bffApi.developApi.api);

swaggerRouter.use(
  "/apiDocs",
  ...swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: { url: null },
  })
);

export default swaggerRouter;
