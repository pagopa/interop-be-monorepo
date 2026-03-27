import { z } from "zod";

export const TokenGenerationValidationConfig = z
  .object({
    TOKEN_GENERATION_READMODEL_TABLE_NAME_INTERACTIONS: z.string(),
  })
  .transform((c) => ({
    interactionsTable: c.TOKEN_GENERATION_READMODEL_TABLE_NAME_INTERACTIONS,
  }));

export type TokenGenerationValidationConfig = z.infer<
  typeof TokenGenerationValidationConfig
>;
