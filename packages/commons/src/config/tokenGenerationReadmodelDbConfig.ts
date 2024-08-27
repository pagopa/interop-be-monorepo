import { z } from "zod";

export const TokenGenerationReadModelDbConfig = z
  .object({
    TOKEN_GENERATION_READMODEL_HOST: z.string(),
    TOKEN_GENERATION_READMODEL_PORT: z.coerce.number().min(1001),
    TOKEN_GENERATION_READMODEL_TABLE_NAME: z.string(),
  })
  .transform((c) => ({
    tokenGenerationReadModelDbHost: c.TOKEN_GENERATION_READMODEL_HOST,
    tokenGenerationReadModelDbPort: c.TOKEN_GENERATION_READMODEL_PORT,
    tokenGenerationReadModelTableName: c.TOKEN_GENERATION_READMODEL_TABLE_NAME,
  }));

export type TokenGenerationReadModelDbConfig = z.infer<
  typeof TokenGenerationReadModelDbConfig
>;
