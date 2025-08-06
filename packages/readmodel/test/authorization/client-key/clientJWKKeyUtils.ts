import { clientJWKKeyReadModelServiceBuilder } from "../../../src/authorization/client-key/clientJWKKeyReadModelService.js";
import { readModelDB } from "../../utils.js";

export const clientJWKKeyReadModelService =
  clientJWKKeyReadModelServiceBuilder(readModelDB);
