import { z } from "zod";

export const TokenGenerationReadModelDbConfig = z
  .object({
    TOKEN_GENERATION_READMODEL_DB_HOST: z.string(),
    TOKEN_GENERATION_READMODEL_DB_NAME: z.string(),
    TOKEN_GENERATION_READMODEL_DB_USERNAME: z.string(),
    TOKEN_GENERATION_READMODEL_DB_PASSWORD: z.string(),
    TOKEN_GENERATION_READMODEL_DB_PORT: z.coerce.number().min(1001),
  })
  .transform((c) => ({
    tokenGenerationReadModelDbHost: c.TOKEN_GENERATION_READMODEL_DB_HOST,
    tokenGenerationReadModelDbName: c.TOKEN_GENERATION_READMODEL_DB_NAME,
    tokenGenerationReadModelDbUsername:
      c.TOKEN_GENERATION_READMODEL_DB_USERNAME,
    tokenGenerationReadModelDbPassword:
      c.TOKEN_GENERATION_READMODEL_DB_PASSWORD,
    tokenGenerationReadModelDbPort: c.TOKEN_GENERATION_READMODEL_DB_PORT,
  }));

export type TokenGenerationReadModelDbConfig = z.infer<
  typeof TokenGenerationReadModelDbConfig
>;
