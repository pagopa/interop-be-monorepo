import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { zodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { config } from "../config/config.js";

const swaggerRouter = zodiosRouter(bffApi.developApi.api);

if (config.bffSwaggerUiEnabled) {
  const pkgUrl = import.meta.resolve("pagopa-interop-api-clients");
  const pkgDir = path.dirname(fileURLToPath(pkgUrl));

  const yamlPath = path.join(path.dirname(pkgDir), "open-api", "bffApi.yml");

  const yamlSpecFile = await fs.readFile(yamlPath, "utf8");
  const swaggerDocument = YAML.parse(yamlSpecFile);

  swaggerRouter.use(
    "/apiDocs",
    ...swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      swaggerOptions: { url: null },
    })
  );
}

export default swaggerRouter;
