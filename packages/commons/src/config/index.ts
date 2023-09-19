import { z } from "zod";
import { APIEndpoint } from "./../model/apiEndpoint.js";

const Config = z
  .object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
    WELL_KNOWN_URLS: z
      .string()
      .transform((s) => s.split(",").map((s) => APIEndpoint.parse(s))),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
    wellKnownUrls: c.WELL_KNOWN_URLS,
  }));

export type Config = z.infer<typeof Config>;
export const config = Config.parse(process.env);
