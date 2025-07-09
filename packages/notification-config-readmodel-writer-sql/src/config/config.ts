import {
  NotificationConfigTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const NotificationConfigReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(NotificationConfigTopicConfig);

export type NotificationConfigReadModelWriterConfig = z.infer<
  typeof NotificationConfigReadModelWriterConfig
>;

export const config: NotificationConfigReadModelWriterConfig =
  NotificationConfigReadModelWriterConfig.parse(process.env);
