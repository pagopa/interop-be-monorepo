import { ZodiosResponseByPath } from "@zodios/core";
import { z } from "zod";
import { api as bff, schemas } from "../generated/api.js";

export type BffApi = typeof bff.api;
export type BffCatalogApiResponse = ZodiosResponseByPath<
  BffApi,
  "get",
  "/catalog"
>;

export type BffCatalogApiEServiceResponse = z.infer<
  typeof schemas.CatalogEService
>;
