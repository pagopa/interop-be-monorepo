import { InferSelectModel } from "drizzle-orm";
import { attributeInReadmodel } from "./drizzle/schema.js";

export type AttributeSQL = InferSelectModel<typeof attributeInReadmodel>;
