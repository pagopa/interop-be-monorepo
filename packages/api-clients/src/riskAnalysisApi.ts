import * as riskAnalysisApi from "./generated/riskAnalysisApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof riskAnalysisApi.processApi.api;

export type RiskAnalysisProcessClient = ReturnType<
  typeof riskAnalysisApi.createProcessApiClient
>;

export type GetRiskAnalysesQueryParams = QueryParametersByAlias<
  Api,
  "getRiskAnalyses"
>;

export * from "./generated/riskAnalysisApi.js";
