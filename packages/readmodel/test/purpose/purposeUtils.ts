import { purposeReadModelServiceBuilder } from "../../src/purpose/purposeReadModelService.js";
import { readModelDB } from "../utils.js";

export const purposeReadModelService =
  purposeReadModelServiceBuilder(readModelDB);
