import { purposeTemplateReadModelServiceBuilder } from "../../src/purpose-template/purposeTemplateReadModelService.js";
import { readModelDB } from "../utils.js";

export const purposeTemplateReadModelService =
  purposeTemplateReadModelServiceBuilder(readModelDB);
