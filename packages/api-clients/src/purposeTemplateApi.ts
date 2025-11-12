import { QueryParametersByAlias } from "./utils.js";
import { purposeTemplateApi } from "./index.js";

type Api = typeof purposeTemplateApi.purposeTemplateApi.api;

export type GetPurposeTemplatesQueryParams = QueryParametersByAlias<
  Api,
  "getPurposeTemplates"
>;

export type RiskAnalysisTemplateAnnotationDocumentsWithAnswerIdQueryParams =
  QueryParametersByAlias<Api, "getRiskAnalysisTemplateAnnotationDocuments">;

export * from "./generated/purposeTemplateApi.js";
