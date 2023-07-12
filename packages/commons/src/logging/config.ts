import * as dotenvFlow from "dotenv-flow";
import { z } from "zod";

dotenvFlow.config();

const Config = z
  .object({
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    logLevel: c.LOG_LEVEL,
  }));

export const config = Config.parse(process.env);
