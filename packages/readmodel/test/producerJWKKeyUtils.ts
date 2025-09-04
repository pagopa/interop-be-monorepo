import { producerJWKKeyReadModelServiceBuilder } from "../src/producerJWKKeyReadModelService.js";
import { readModelDB } from "./utils.js";

export const producerJWKKeyReadModelService =
  producerJWKKeyReadModelServiceBuilder(readModelDB);
