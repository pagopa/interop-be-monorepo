import * as dotenvFlow from "dotenv-flow";
import { z } from "zod";
import { APIEndpoint } from "../models/apiEndpoint.js";

dotenvFlow.config();

const Config = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
    POSTGRESQL_URI: z.string(),
  })
  .transform((c) => ({
    dbURL: c.POSTGRESQL_URI,
    host: c.HOST,
    port: c.PORT,
  }));

export const config = Config.parse(process.env);
