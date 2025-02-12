import { InferSelectModel } from "drizzle-orm";
import {
  clientInReadmodel,
  clientKeyInReadmodel,
  clientPurposeInReadmodel,
  clientUserInReadmodel,
} from "./drizzle/schema.js";

export type ClientSQL = InferSelectModel<typeof clientInReadmodel>;
export type ClientUserSQL = InferSelectModel<typeof clientUserInReadmodel>;
export type ClientPurposeSQL = InferSelectModel<
  typeof clientPurposeInReadmodel
>;
export type ClientKeySQL = InferSelectModel<typeof clientKeyInReadmodel>;
