import * as eserviceTemplateApi from "./generated/eserviceTemplateApi.js";
import { QueryParametersByAlias } from "./utils.js";

type EServiceTemplateApi = typeof eserviceTemplateApi.processApi.api;

export type EServiceTemplateProcessClient = ReturnType<
  typeof eserviceTemplateApi.createProcessApiClient
>;

export type GetEServiceTemplatesQueryParams = QueryParametersByAlias<
  EServiceTemplateApi,
  "getEServiceTemplates"
>;

export * from "./generated/eserviceTemplateApi.js";
