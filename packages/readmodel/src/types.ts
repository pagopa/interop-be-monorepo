import { InferSelectModel } from "drizzle-orm";
import {
  producerKeychainEserviceInReadmodel,
  producerKeychainInReadmodel,
  producerKeychainKeyInReadmodel,
  producerKeychainUserInReadmodel,
} from "./drizzle/schema.js";

export type ProducerKeychainSQL = InferSelectModel<
  typeof producerKeychainInReadmodel
>;
export type ProducerKeychainUserSQL = InferSelectModel<
  typeof producerKeychainUserInReadmodel
>;
export type ProducerKeychainEServiceSQL = InferSelectModel<
  typeof producerKeychainEserviceInReadmodel
>;
export type ProducerKeychainKeySQL = InferSelectModel<
  typeof producerKeychainKeyInReadmodel
>;
