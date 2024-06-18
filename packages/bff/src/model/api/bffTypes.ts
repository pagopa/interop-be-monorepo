/* eslint-disable @typescript-eslint/array-type */
import { ZodiosResponseByPath } from "@zodios/core";
import { api as bff } from "../generated/api.js";

type ArrayElement<T> = T extends (infer U)[] ? U : never;

export type BffApi = typeof bff.api;
export type BffCatalogApiResponse = ZodiosResponseByPath<
  BffApi,
  "get",
  "/catalog"
>;

export type BffCatalogApiEServiceResponse = ArrayElement<
  BffCatalogApiResponse["results"]
>;

export type BffTokenResponse = ZodiosResponseByPath<
  BffApi,
  "post",
  "/session/tokens"
>;

