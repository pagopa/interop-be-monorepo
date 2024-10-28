import { FileManagerConfig, LoggerConfig } from "pagopa-interop-commons";
import { z } from "zod";

export const DatalakeInterfaceExporterConfig = LoggerConfig.and(
  FileManagerConfig
).and(
  z.object({
    ESERVICE_DOCUMENTS_S3_BUCKET: z.string(),
    ESERVICE_DOCUMENTS_S3_PATH: z.string(),
    DATALAKE_INTERFACES_EXPORT_S3_BUCKET: z.string(),
    DATALAKE_INTERFACES_EXPORT_S3_PATH: z.string(),
  })
);

export type DatalakeInterfaceExporterConfig = z.infer<
  typeof DatalakeInterfaceExporterConfig
>;
export const config: DatalakeInterfaceExporterConfig =
  DatalakeInterfaceExporterConfig.parse(process.env);
