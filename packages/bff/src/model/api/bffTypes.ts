import { ZodiosHeaderParamsByPath, ZodiosResponseByPath } from "@zodios/core";
import { z } from "zod";
import { api as bff, schemas } from "../generated/api.js";

export type BffApi = typeof bff.api;
export type BffGetCatalogApiResponse = ZodiosResponseByPath<
  BffApi,
  "get",
  "/catalog"
>;

export type BffGetCatalogApiHeaders = ZodiosHeaderParamsByPath<
  BffApi,
  "get",
  "/catalog"
>;

export type BffCatalogApiEServiceResponse = z.infer<
  typeof schemas.CatalogEService
>;
