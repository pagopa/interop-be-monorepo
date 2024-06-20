import { z } from "zod";

export const LoggerConfig = z
  .object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
  }));
export type LoggerConfig = z.infer<typeof LoggerConfig>;
