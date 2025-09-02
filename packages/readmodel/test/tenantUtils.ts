import { tenantReadModelServiceBuilder } from "../src/tenantReadModelService.js";
import { readModelDB } from "./utils.js";

export const tenantReadModelService =
  tenantReadModelServiceBuilder(readModelDB);
