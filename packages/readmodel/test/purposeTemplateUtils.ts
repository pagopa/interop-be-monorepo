import { purposeTemplateReadModelServiceBuilder } from "../src/purposeTemplateReadModelService.js";
import { readModelDB } from "./utils.js";

export const purposeTemplateReadModelService =
  purposeTemplateReadModelServiceBuilder(readModelDB);
