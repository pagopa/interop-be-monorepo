import { attributeReadModelServiceBuilder } from "../../src/attribute/attributeReadModelService.js";
import { readModelDB } from "../utils.js";

export const attributeReadModelService =
  attributeReadModelServiceBuilder(readModelDB);
