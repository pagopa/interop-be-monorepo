import * as fs from "fs";
import { openApiBuilder } from "@zodios/openapi";
import YAML from "yaml";
import { api } from "./catalog_api";

const document = openApiBuilder({
  title: "User API",
  version: "1.0.0",
  description: "A simple user API",
})
  .addPublicApi(api.api)
  .build();

fs.writeFileSync("openapi.yaml", YAML.stringify(document));
