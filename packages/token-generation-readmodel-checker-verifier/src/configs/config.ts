import {
  LoggerConfig,
  PlatformStateWriterConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TokenReadModelCheckerVerifierConfig = LoggerConfig.and(
  ReadModelDbConfig
).and(PlatformStateWriterConfig);

export type TokenReadModelCheckerConfig = z.infer<
  typeof TokenReadModelCheckerVerifierConfig
>;

export const config: TokenReadModelCheckerConfig =
  TokenReadModelCheckerVerifierConfig.parse(process.env);
