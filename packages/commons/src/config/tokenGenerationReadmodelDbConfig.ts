import { z } from "zod";

export const TokenGenerationReadModelDbConfig = z
  .object({
    TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM: z.string(),
    TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
  })
  .transform((c) => ({
    tokenGenerationReadModelTableNamePlatform:
      c.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
    tokenGenerationReadModelTableNameTokenGeneration:
      c.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
  }));

export type TokenGenerationReadModelDbConfig = z.infer<
  typeof TokenGenerationReadModelDbConfig
>;
