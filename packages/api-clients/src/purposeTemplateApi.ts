import * as purposeTemplateApi from "./generated/purposeTemplateApi.js";
import { QueryParametersByAlias } from "./utils.js";

type PurposeTemplateApi = typeof purposeTemplateApi.purposeTemplateApi.api;

export type GetPurposeTemplatesQueryParams = QueryParametersByAlias<
  PurposeTemplateApi,
  "getPurposeTemplates"
>;

export * from "./generated/purposeTemplateApi.js";
