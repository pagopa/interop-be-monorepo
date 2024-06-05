import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  EventStoreConfig,
  FileManagerConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeProcessConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(EventStoreConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(
    z
      .object({
        RISK_ANALYSIS_PATH: z.string(),
      })
      .transform((c) => ({
        riskAnalysisPath: c.RISK_ANALYSIS_PATH,
      }))
  );

export type PurposeProcessConfig = z.infer<typeof PurposeProcessConfig>;

export const config: PurposeProcessConfig = {
  ...PurposeProcessConfig.parse(process.env),
};
