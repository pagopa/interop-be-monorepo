import {
  LoggerConfig,
  ReadModelDbConfig,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TokenReadModelCheckerConfig = LoggerConfig.and(ReadModelDbConfig).and(
  TokenGenerationReadModelDbConfig
);

export type TokenReadModelCheckerConfig = z.infer<
  typeof TokenReadModelCheckerConfig
>;

export const config: TokenReadModelCheckerConfig =
  TokenReadModelCheckerConfig.parse(process.env);
