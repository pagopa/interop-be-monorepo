import { z } from "zod";
import {
  config as commonsConfig,
  Config as CommonConfig,
  HTTPServerConfig,
} from "pagopa-interop-commons";

const LocalConfig = z.object({}).transform(() => ({}));
const RequiredConfig = z
  .object({
    READMODEL_DB_HOST: z.string(),
    READMODEL_DB_NAME: z.string(),
    READMODEL_DB_USERNAME: z.string(),
    READMODEL_DB_PASSWORD: z.string(),
    READMODEL_DB_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    readModelDbHost: c.READMODEL_DB_HOST,
    readModelDbName: c.READMODEL_DB_NAME,
    readModelDbUsername: c.READMODEL_DB_USERNAME,
    readModelDbPassword: c.READMODEL_DB_PASSWORD,
    readModelDbPort: c.READMODEL_DB_PORT,
  }));

const Config = LocalConfig.and(HTTPServerConfig).and(RequiredConfig);
export type Config = z.infer<typeof Config>;

export const config: Config & CommonConfig = {
  ...commonsConfig,
  ...Config.parse(process.env),
};
