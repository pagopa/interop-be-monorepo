import {
  CommonConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  FileManagerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonConfig.and(ReadModelDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(
    z
      .object({
        S3_BUCKET: z.string(),
        RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        s3Bucket: c.S3_BUCKET,
        riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
      }))
  );

export type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = {
  ...PurposeProcessConfig.parse(process.env),
};
