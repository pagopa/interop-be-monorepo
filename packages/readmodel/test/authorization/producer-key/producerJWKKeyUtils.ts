import { producerJWKKeyReadModelServiceBuilder } from "../../../src/authorization/producer-key/producerJWKKeyReadModelService.js";
import { readModelDB } from "../../utils.js";

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);
