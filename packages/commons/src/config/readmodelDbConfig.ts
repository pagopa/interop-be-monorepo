import { z } from "zod";

export const ReadModelDbConfig = z
  .object({
    READMODEL_DB_HOST: z.string(),
    READMODEL_DB_NAME: z.string(),
    READMODEL_DB_USERNAME: z.string(),
    READMODEL_DB_PASSWORD: z.string(),
    READMODEL_DB_PORT: z.coerce.number().min(1001),
    READMODEL_DB_READ_PREFERENCE: z.string(),
    READMODEL_DB_REPLICA_SET: z.string(),
  })
  .transform((c) => ({
    readModelDbHost: c.READMODEL_DB_HOST,
    readModelDbName: c.READMODEL_DB_NAME,
    readModelDbUsername: c.READMODEL_DB_USERNAME,
    readModelDbPassword: c.READMODEL_DB_PASSWORD,
    readModelDbPort: c.READMODEL_DB_PORT,
    readModelDbReadPreference: c.READMODEL_DB_READ_PREFERENCE,
    readModelDbReplicaSet: c.READMODEL_DB_REPLICA_SET,
  }));

export type ReadModelDbConfig = z.infer<typeof ReadModelDbConfig>;
