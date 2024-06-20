import {
  ReadModelWriterConfig,
  TenantTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const TenantReadModelWriterConfig =
  ReadModelWriterConfig.and(TenantTopicConfig);

export type TenantReadModelWriterConfig = z.infer<
  typeof TenantReadModelWriterConfig
>;

export const config: TenantReadModelWriterConfig =
  TenantReadModelWriterConfig.parse(process.env);
