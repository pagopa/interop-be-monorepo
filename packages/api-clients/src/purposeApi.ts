import * as purposeApi from "./generated/purposeApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof purposeApi.purposeApi.api;

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type GetPurposesQueryParams = QueryParametersByAlias<Api, "getPurposes">;

export * from "./generated/purposeApi.js";
