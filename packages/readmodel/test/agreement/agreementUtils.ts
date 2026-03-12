import { agreementReadModelServiceBuilder } from "../../src/agreement/agreementReadModelService.js";
import { readModelDB } from "../utils.js";

export const agreementReadModelService =
  agreementReadModelServiceBuilder(readModelDB);
