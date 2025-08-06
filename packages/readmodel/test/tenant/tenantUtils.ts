import { tenantReadModelServiceBuilder } from "../../src/tenant/tenantReadModelService.js";
import { readModelDB } from "../utils.js";

export const tenantReadModelService =
  tenantReadModelServiceBuilder(readModelDB);
