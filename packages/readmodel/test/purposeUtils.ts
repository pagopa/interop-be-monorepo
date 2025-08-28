import { purposeReadModelServiceBuilder } from "../src/purposeReadModelService.js";
import { readModelDB } from "./utils.js";

export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);
