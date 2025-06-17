import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const InAppNotificationManagerConfig = CommonHTTPServiceConfig.and(
  ApplicationAuditProducerConfig
).and(
  z
    .object({
      DB_HOST: z.string(),
      DB_NAME: z.string(),
      DB_USERNAME: z.string(),
      DB_PASSWORD: z.string(),
      DB_PORT: z.coerce.number().min(1001),
    })
    .transform((c) => ({
      dbHost: c.DB_HOST,
      dbName: c.DB_NAME,
      dbUsername: c.DB_USERNAME,
      dbPassword: c.DB_PASSWORD,
      dbPort: c.DB_PORT,
    }))
);

export type InAppNotificationManagerConfig = z.infer<
  typeof InAppNotificationManagerConfig
>;

export const config: InAppNotificationManagerConfig =
  InAppNotificationManagerConfig.parse(process.env);
