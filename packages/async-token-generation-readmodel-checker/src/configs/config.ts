import { LoggerConfig, ReadModelSQLDbConfig } from "pagopa-interop-commons";
import { z } from "zod";

const AsyncTokenReadModelCheckerConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(
    z.object({
      TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM: z.string(),
      TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION: z.string(),
      TOKEN_GENERATION_READMODEL_TABLE_NAME_INTERACTIONS: z.string(),
      PRODUCER_KEYCHAIN_PLATFORM_STATES_TABLE_NAME: z.string(),
      INTERACTION_TTL_EPSILON_SECONDS: z.coerce.number().optional(),
    })
  )
  .transform((c) => ({
    ...c,
    platformStatesTable: c.TOKEN_GENERATION_READMODEL_TABLE_NAME_PLATFORM,
    tokenGenerationStatesTable:
      c.TOKEN_GENERATION_READMODEL_TABLE_NAME_TOKEN_GENERATION,
    interactionsTable: c.TOKEN_GENERATION_READMODEL_TABLE_NAME_INTERACTIONS,
    producerKeychainPlatformStatesTable:
      c.PRODUCER_KEYCHAIN_PLATFORM_STATES_TABLE_NAME,
    interactionTtlEpsilonSeconds: c.INTERACTION_TTL_EPSILON_SECONDS,
  }));

type AsyncTokenReadModelCheckerConfig = z.infer<
  typeof AsyncTokenReadModelCheckerConfig
>;

export const config: AsyncTokenReadModelCheckerConfig =
  AsyncTokenReadModelCheckerConfig.parse(process.env);
