import { attributeReadModelServiceBuilder } from "../src/attributeReadModelService.js";
import { readModelDB } from "./utils.js";

export const attributeReadModelService =
  attributeReadModelServiceBuilder(readModelDB);
