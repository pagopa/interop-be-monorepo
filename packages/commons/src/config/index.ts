import { z } from "zod";

const Config = z
  .object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
  }));

export type Config = z.infer<typeof Config>;
export const config = Config.parse(process.env);
