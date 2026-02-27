import { pgSchema } from "drizzle-orm/pg-core";
import { config } from "./config/config.js";

export const m2mEvent = pgSchema(config.m2mEventSQLDbSchema);
