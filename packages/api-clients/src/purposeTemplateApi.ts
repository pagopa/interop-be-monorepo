import * as purposeTemplateApi from "./generated/purposeTemplateApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof purposeTemplateApi.purposeTemplateApi.api;

export type GetPurposeTemplatesQueryParams = QueryParametersByAlias<
  Api,
  "getPurposeTemplates"
>;

export * from "./generated/purposeTemplateApi.js";
