import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  FileManagerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(
    z
      .object({
        S3_BUCKET: z.string(),
        RISK_ANALYSIS_PATH: z.string(),
      })
      .transform((c) => ({
        s3Bucket: c.S3_BUCKET,
        riskAnalysisPath: c.RISK_ANALYSIS_PATH,
      }))
  );

export type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = {
  ...PurposeProcessConfig.parse(process.env),
};
