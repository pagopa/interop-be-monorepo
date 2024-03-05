import {
  CommonConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CataloProcessConfig = CommonConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(EventStoreConfig)
  .and(
    z
      .object({
        S3_BUCKET: z.string(),
        ESERVICE_DOCUMENTS_PATH: z.string(),
        PRODUCER_ALLOWED_ORIGINS: z.string(),
      })
      .transform((c) => ({
        s3Bucket: c.S3_BUCKET,
        eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
        producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(","),
      }))
  );

export type CatalogProcessConfig = z.infer<typeof CataloProcessConfig>;

export const config: CatalogProcessConfig = {
  ...CataloProcessConfig.parse(process.env),
};
