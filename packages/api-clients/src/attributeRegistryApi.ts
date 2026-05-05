import { ZodiosBodyByPath } from "@zodios/core";
import * as attributeRegistryApi from "./generated/attributeRegistryApi.js";
import { QueryParametersByAlias } from "./utils.js";

type Api = typeof attributeRegistryApi.attributeApi.api;

export type AttributeProcessClient = ReturnType<
  typeof attributeRegistryApi.createAttributeApiClient
>;

export type GetAttributesQueryParams = QueryParametersByAlias<
  Api,
  "getAttributes"
>;

export type ApiBulkAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/bulk/attributes"
>;

export * from "./generated/attributeRegistryApi.js";
