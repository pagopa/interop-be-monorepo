import { clientJWKKeyReadModelServiceBuilder } from "../src/client-jwk-key/clientJWKKeyReadModelService.js";
import { readModelDB } from "./utils.js";

export const clientJWKKeyReadModelService =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
