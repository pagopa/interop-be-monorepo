import { eserviceTemplateReadModelServiceBuilder } from "../src/eserviceTemplateReadModelService.js";
import { readModelDB } from "./utils.js";

export const eserviceTemplateReadModelService =
  eserviceTemplateReadModelServiceBuilder(readModelDB);
