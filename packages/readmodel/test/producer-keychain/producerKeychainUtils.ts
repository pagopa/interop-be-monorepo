import { producerKeychainReadModelServiceBuilder } from "../../src/producer-keychain/producerKeychainReadModelService.js";
import { readModelDB } from "../utils.js";

export const producerKeychainReadModelService =
  producerKeychainReadModelServiceBuilder(readModelDB);
