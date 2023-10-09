import { z } from "zod";
import {
  config as commonsConfig,
  Config as CommonConfig,
  APIEndpoint,
} from "pagopa-interop-commons";

const Config = z
  .object({
    HOST: APIEndpoint,
    PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    host: c.HOST,
    port: c.PORT,
  }));

export type Config = z.infer<typeof Config>;

export const config: Config & CommonConfig = {
  ...commonsConfig,
  ...Config.parse(process.env),
};
