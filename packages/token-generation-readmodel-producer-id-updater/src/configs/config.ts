import {
  LoggerConfig,
  ReadModelDbConfig,
  TokenGenerationReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TokenGenReadModelProducerIdUpdaterConfig = LoggerConfig.and(
  ReadModelDbConfig
).and(TokenGenerationReadModelDbConfig);
export type TokenGenReadModelProducerIdUpdaterConfig = z.infer<
  typeof TokenGenReadModelProducerIdUpdaterConfig
>;

export const config: TokenGenReadModelProducerIdUpdaterConfig =
  TokenGenReadModelProducerIdUpdaterConfig.parse(process.env);
