import { agreementReadModelServiceBuilder } from "../src/agreementReadModelService.js";
import { readModelDB } from "./utils.js";

export const agreementReadModelService =
  agreementReadModelServiceBuilder(readModelDB);
