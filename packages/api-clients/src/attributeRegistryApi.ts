import { ZodiosBodyByPath } from "@zodios/core";
import * as attributeRegistryApi from "./generated/attributeRegistryApi.js";

type Api = typeof attributeRegistryApi.attributeApi.api;

export type ApiBulkAttributeSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/bulk/attributes"
>;

export * from "./generated/attributeRegistryApi.js";
