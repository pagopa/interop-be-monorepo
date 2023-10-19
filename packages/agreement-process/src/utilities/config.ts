import { z } from "zod";
import {
  config as commonsConfig,
  Config as CommonConfig,
  HTTPServerConfig,
  FileManagerConfig,
} from "pagopa-interop-commons";

const LocalConfig = z.object({}).transform(() => ({}));
const RequiredConfig = z
  .object({
    EVENTSTORE_DB_HOST: z.string(),
    EVENTSTORE_DB_NAME: z.string(),
    EVENTSTORE_DB_USERNAME: z.string(),
    EVENTSTORE_DB_PASSWORD: z.string(),
    EVENTSTORE_DB_PORT: z.coerce.number().min(1001),
    EVENTSTORE_DB_SCHEMA: z.string(),
    EVENTSTORE_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    READMODEL_DB_HOST: z.string(),
    READMODEL_DB_NAME: z.string(),
    READMODEL_DB_USERNAME: z.string(),
    READMODEL_DB_PASSWORD: z.string(),
    READMODEL_DB_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    eventStoreDbHost: c.EVENTSTORE_DB_HOST,
    eventStoreDbName: c.EVENTSTORE_DB_NAME,
    eventStoreDbUsername: c.EVENTSTORE_DB_USERNAME,
    eventStoreDbPassword: c.EVENTSTORE_DB_PASSWORD,
    eventStoreDbPort: c.EVENTSTORE_DB_PORT,
    eventStoreDbSchema: c.EVENTSTORE_DB_SCHEMA,
    eventStoreDbUseSSL: c.EVENTSTORE_DB_USE_SSL,
    readModelDbHost: c.READMODEL_DB_HOST,
    readModelDbName: c.READMODEL_DB_NAME,
    readModelDbUsername: c.READMODEL_DB_USERNAME,
    readModelDbPassword: c.READMODEL_DB_PASSWORD,
    readModelDbPort: c.READMODEL_DB_PORT,
  }));

const Config = LocalConfig.and(HTTPServerConfig)
  .and(FileManagerConfig)
  .and(RequiredConfig);
export type Config = z.infer<typeof Config>;

export const config: Config & CommonConfig = {
  ...commonsConfig,
  ...Config.parse(process.env),
};
