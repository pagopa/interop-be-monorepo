import {
  LoggerConfig,
  ReadModelDbConfig,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TokenGenReadModelScriptConfig = LoggerConfig.and(ReadModelDbConfig).and(
  TokenGenerationReadModelDbConfig
);
export type TokenGenReadModelScriptConfig = z.infer<
  typeof TokenGenReadModelScriptConfig
>;

export const config: TokenGenReadModelScriptConfig =
  TokenGenReadModelScriptConfig.parse(process.env);
