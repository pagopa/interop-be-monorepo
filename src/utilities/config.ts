import * as dotenvFlow from "dotenv-flow";
import { z } from "zod";
import { APIEndpoint } from "../model/apiEndpoint.js";

dotenvFlow.config();

const Config = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
    POSTGRESQL_URI: z.string(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  })
  .transform((c) => ({
    host: c.HOST,
    port: c.PORT,
    dbURL: c.POSTGRESQL_URI,
    logLevel: c.LOG_LEVEL,
  }));

export const config = Config.parse(process.env);
