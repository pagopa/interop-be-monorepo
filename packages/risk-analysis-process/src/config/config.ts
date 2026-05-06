import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
} from "pagopa-interop-commons";

const RiskAnalysisConfig = CommonHTTPServiceConfig.and(EventStoreConfig);

export const config = RiskAnalysisConfig.parse(process.env);
