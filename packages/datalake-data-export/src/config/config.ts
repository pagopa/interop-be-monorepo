import {
  AWSConfig,
  EventStoreConfig,
  MongoDBConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DatalakeStorageConfig = z
  .object({
    DATALAKE_STORAGE_BUCKET: z.string(),
  })
  .transform((c) => ({
    storageBucket: c.DATALAKE_STORAGE_BUCKET,
  }));
export type DatalakeStorageConfig = z.infer<typeof DatalakeExporterConfig>;

export const DatalakeExporterConfig = DatalakeStorageConfig.and(AWSConfig)
  .and(EventStoreConfig)
  .and(MongoDBConfig);

export type DatalakeExporterConfig = z.infer<typeof DatalakeExporterConfig>;
export const config: DatalakeExporterConfig = DatalakeExporterConfig.parse(
  process.env
);
