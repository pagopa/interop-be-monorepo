import {
  CatalogTopicConfig,
  FileManagerConfig,
  KafkaConsumerConfig,
  LoggerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const DatalakeInterfaceExporterConfig = LoggerConfig.and(FileManagerConfig)
  .and(KafkaConsumerConfig)
  .and(CatalogTopicConfig)
  .and(
    z
      .object({
        ESERVICE_DOCUMENTS_S3_BUCKET: z.string(),
        DATALAKE_INTERFACES_EXPORT_S3_BUCKET: z.string(),
        DATALAKE_INTERFACES_EXPORT_PATH: z.string(),
      })
      .transform((c) => ({
        eserviceDocumentsS3Bucket: c.ESERVICE_DOCUMENTS_S3_BUCKET,
        datalakeInterfacesExportS3Bucket:
          c.DATALAKE_INTERFACES_EXPORT_S3_BUCKET,
        datalakeInterfacesExportPath: c.DATALAKE_INTERFACES_EXPORT_PATH,
      }))
  );

type DatalakeInterfaceExporterConfig = z.infer<
  typeof DatalakeInterfaceExporterConfig
>;
export const config: DatalakeInterfaceExporterConfig =
  DatalakeInterfaceExporterConfig.parse(process.env);
