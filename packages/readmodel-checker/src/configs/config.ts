import {
  LoggerConfig,
  ReadModelDbConfig,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ReadModelCheckerConfig = LoggerConfig.and(ReadModelDbConfig)
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

export type ReadModelCheckerConfig = z.infer<typeof ReadModelCheckerConfig>;

export const config: ReadModelCheckerConfig = ReadModelCheckerConfig.parse(
  process.env
);
