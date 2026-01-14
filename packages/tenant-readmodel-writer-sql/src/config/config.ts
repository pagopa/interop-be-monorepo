import {
  ReadModelWriterConfigSQL,
  TenantTopicConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TenantReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(TenantTopicConfig);

type TenantReadModelWriterConfig = z.infer<typeof TenantReadModelWriterConfig>;

export const config: TenantReadModelWriterConfig =
  TenantReadModelWriterConfig.parse(process.env);
