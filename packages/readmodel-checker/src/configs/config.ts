import { LoggerConfig, ReadModelDbConfig } from "pagopa-interop-commons";
import { z } from "zod";

const ReadModelCheckerConfig = LoggerConfig.and(ReadModelDbConfig);

export type ReadModelCheckerConfig = z.infer<typeof ReadModelCheckerConfig>;

export const config: ReadModelCheckerConfig = ReadModelCheckerConfig.parse(
  process.env
);
