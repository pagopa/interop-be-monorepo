import { z } from "zod";

export const TokenGenerationReadModelDbConfig = z
  .object({
    TOKEN_GENERATION_READMODEL_HOST: z.string(),
    TOKEN_GENERATION_READMODEL_PORT: z.coerce.number().min(1001),
    TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM: z.string(),
    TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
  })
  .transform((c) => ({
    tokenGenerationReadModelDbHost: c.TOKEN_GENERATION_READMODEL_HOST,
    tokenGenerationReadModelDbPort: c.TOKEN_GENERATION_READMODEL_PORT,
    tokenGenerationReadModelTableNamePlatform:
      c.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
    tokenGenerationReadModelTableNameTokenGeneration:
      c.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
    awsAccessKeyId: c.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: c.AWS_SECRET_ACCESS_KEY,
  }));

export type TokenGenerationReadModelDbConfig = z.infer<
  typeof TokenGenerationReadModelDbConfig
>;
