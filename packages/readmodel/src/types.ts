import { InferSelectModel } from "drizzle-orm";
import { clientJwkKeyInReadmodel } from "./drizzle/schema.js";

export type ClientJWKKeySQL = InferSelectModel<typeof clientJwkKeyInReadmodel>;
