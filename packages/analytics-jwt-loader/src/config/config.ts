import { LoggerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const AnalyticsJwTLoaderConfig = LoggerConfig.and(
  z
    .object({
      NOTIFICATION_QUEUE_URL: z.string(),
      CONSUMER_POLLING_TIMEOUT_IN_SECONDS: z.coerce.number().min(1),
      SERVICE_NAME: z.string(),
      AWS_REGION: z.string(),
    })
    .transform((c) => ({
      queueUrl: c.NOTIFICATION_QUEUE_URL,
      consumerPollingTimeout: c.CONSUMER_POLLING_TIMEOUT_IN_SECONDS,
      serviceName: c.SERVICE_NAME,
      awsRegion: c.AWS_REGION,
    }))
);
export type AnalyticsJwTLoaderConfig = z.infer<typeof AnalyticsJwTLoaderConfig>;

export const config: AnalyticsJwTLoaderConfig = AnalyticsJwTLoaderConfig.parse(
  process.env
);
