import {
  LoggerConfig,
  ReadModelSQLDbConfig,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TokenReadModelCheckerConfig = LoggerConfig.and(ReadModelSQLDbConfig)
  .and(TokenGenerationReadModelDbConfig)
  .and(
    z
      .object({
        AGREEMENTS_TO_SKIP: z.string(),
      })
      .transform((c) => ({
        agreementsToSkip: c.AGREEMENTS_TO_SKIP.split(","),
      }))
  );

export type TokenReadModelCheckerConfig = z.infer<
  typeof TokenReadModelCheckerConfig
>;

export const config: TokenReadModelCheckerConfig =
  TokenReadModelCheckerConfig.parse(process.env);
