import { producerJWKKeyReadModelServiceBuilder } from "../../src/producer-jwk-key/producerJWKKeyReadModelService.js";
import { readModelDB } from "../utils.js";

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);
