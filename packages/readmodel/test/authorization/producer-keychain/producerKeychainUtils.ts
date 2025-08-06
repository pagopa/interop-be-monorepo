import { producerKeychainReadModelServiceBuilder } from "../../../src/authorization/producer-keychain/producerKeychainReadModelService.js";
import { readModelDB } from "../../utils.js";

export const producerKeychainReadModelService =
  producerKeychainReadModelServiceBuilder(readModelDB);
