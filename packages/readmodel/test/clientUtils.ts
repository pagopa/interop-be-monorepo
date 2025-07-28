import { clientReadModelServiceBuilder } from "../src/clientReadModelService.js";
import { readModelDB } from "./utils.js";

export const clientReadModelService =
  clientReadModelServiceBuilder(readModelDB);
