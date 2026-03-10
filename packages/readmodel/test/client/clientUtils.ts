import { clientReadModelServiceBuilder } from "../../src/client/clientReadModelService.js";
import { readModelDB } from "../utils.js";

export const clientReadModelService =
  clientReadModelServiceBuilder(readModelDB);
