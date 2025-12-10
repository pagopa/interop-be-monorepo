import { pgSchema } from "drizzle-orm/pg-core";
import { config } from "../config/config.js";

export const digestTrackingSchema = pgSchema(config.digestTrackingDbSchema);
