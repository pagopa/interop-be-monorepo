import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";
import path from "path";
import { zodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const swaggerRouter = zodiosRouter(bffApi.docsApi.api);

const yamlSpecFile = readFileSync(
  path.join(dirname, "../../../api-clients/open-api/bffApi.yml"),
  "utf8"
);
const swaggerDocument = YAML.parse(yamlSpecFile);

swaggerRouter.use(
  "/api-docs",
  ...swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

export default swaggerRouter;
