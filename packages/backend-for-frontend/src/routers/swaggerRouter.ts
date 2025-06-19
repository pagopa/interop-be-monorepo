import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import path from "path";
import { zodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { config } from "../config/config.js";

const YML_SPEC_PATH = "../../../api-clients/open-api/bffApi.yml";
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const swaggerRouter = zodiosRouter(bffApi.docsApi.api);

const yamlSpecFile = readFileSync(path.join(dirname, YML_SPEC_PATH), "utf8");
const swaggerDocument = YAML.parse(yamlSpecFile);

if (config.bffSwaggerUiEnabled) {
  swaggerRouter.use(
    "/api-docs",
    ...swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        url: null,
      },
    })
  );
}

export default swaggerRouter;
