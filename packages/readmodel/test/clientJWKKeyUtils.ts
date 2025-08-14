import { clientJWKKeyReadModelServiceBuilder } from "../src/clientJWKKeyReadModelService.js";
import { readModelDB } from "./utils.js";

export const clientJWKKeyReadModelService =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
