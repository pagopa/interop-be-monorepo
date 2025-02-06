import {
  FileManagerConfig,
  LoggerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

export const AnalyticsJwTLoaderConfig = S3Config.and(
  FileManagerConfig.and(
    LoggerConfig.and(
      z
        .object({
          NOTIFICATION_QUEUE_URL: z.string(),
          CONSUMER_POLLING_TIMEOUT_IN_SECONDS: z.coerce.number().min(1),
          SERVICE_NAME: z.string(),
          AWS_REGION: z.string(),
          S3_BUCKET: z.string(),
          RUN_UNTIL_QUEUE_IS_EMPTY: z.coerce.boolean(),
        })
        .transform((c) => ({
          queueUrl: c.NOTIFICATION_QUEUE_URL,
          consumerPollingTimeout: c.CONSUMER_POLLING_TIMEOUT_IN_SECONDS,
          serviceName: c.SERVICE_NAME,
          awsRegion: c.AWS_REGION,
          s3Bucket: c.S3_BUCKET,
          runUntilQueueIsEmpty: c.RUN_UNTIL_QUEUE_IS_EMPTY,
        }))
    )
  )
);
export type AnalyticsJwTLoaderConfig = z.infer<typeof AnalyticsJwTLoaderConfig>;

export const config: AnalyticsJwTLoaderConfig = AnalyticsJwTLoaderConfig.parse(
  process.env
);
