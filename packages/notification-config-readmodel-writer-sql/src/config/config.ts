import {
  NotificationConfigTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const NotificationConfigReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  NotificationConfigTopicConfig
);

type NotificationConfigReadModelWriterConfig = z.infer<
  typeof NotificationConfigReadModelWriterConfig
>;

export const config: NotificationConfigReadModelWriterConfig =
  NotificationConfigReadModelWriterConfig.parse(process.env);
