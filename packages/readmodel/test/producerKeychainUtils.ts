import { producerKeychainReadModelServiceBuilder } from "../src/producerKeychainReadModelService.js";
import { readModelDB } from "./utils.js";

export const producerKeychainReadModelService =
  producerKeychainReadModelServiceBuilder(readModelDB);
