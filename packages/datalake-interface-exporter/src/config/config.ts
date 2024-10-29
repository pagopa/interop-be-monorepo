import {
  CatalogTopicConfig,
  FileManagerConfig,
  KafkaConsumerConfig,
  LoggerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DatalakeInterfaceExporterConfig = LoggerConfig.and(
  FileManagerConfig
)
  .and(KafkaConsumerConfig)
  .and(CatalogTopicConfig)
  .and(
    z.object({
      eserviceDocumentsS3Bucket: z.string(),
      datalakeInterfacesExportS3Bucket: z.string(),
    })
  );

export type DatalakeInterfaceExporterConfig = z.infer<
  typeof DatalakeInterfaceExporterConfig
>;
export const config: DatalakeInterfaceExporterConfig =
  DatalakeInterfaceExporterConfig.parse(process.env);
