import * as purposeTemplateApi from "./generated/purposeTemplateApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof purposeTemplateApi.purposeTemplateApi.api;

export type PurposeTemplateProcessClient = ReturnType<
  typeof purposeTemplateApi.createPurposeTemplateApiClient
>;

export type GetPurposeTemplatesQueryParams = QueryParametersByAlias<
  Api,
  "getPurposeTemplates"
>;

export type GetRiskAnalysisTemplateAnnotationDocumentsQueryParams =
  QueryParametersByAlias<Api, "getRiskAnalysisTemplateAnnotationDocuments">;

export * from "./generated/purposeTemplateApi.js";
