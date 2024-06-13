import { z } from "zod";

export const ReadModelDbConfig = z
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

export type ReadModelDbConfig = z.infer<typeof ReadModelDbConfig>;
export const readModelDbConfig: () => ReadModelDbConfig = () =>
  ReadModelDbConfig.parse(process.env);
