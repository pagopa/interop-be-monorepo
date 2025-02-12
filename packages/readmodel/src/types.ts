import { InferSelectModel } from "drizzle-orm";
import { producerJwkKeyInReadmodel } from "./drizzle/schema.js";

export type ProducerJWKKeySQL = InferSelectModel<
  typeof producerJwkKeyInReadmodel
>;
