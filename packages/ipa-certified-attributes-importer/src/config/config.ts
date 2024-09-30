import { LoggerConfig, ReadModelDbConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const IPACertifiedAttributesImporterConfig =
  LoggerConfig.and(ReadModelDbConfig);

export type IPACertifiedAttributesImporterConfig = z.infer<
  typeof IPACertifiedAttributesImporterConfig
>;

export const config: IPACertifiedAttributesImporterConfig =
  IPACertifiedAttributesImporterConfig.parse(process.env);
