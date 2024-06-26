import {
  ZodiosHeaderParamsByPath,
  ZodiosQueryParamsByPath,
  ZodiosResponseByPath,
} from "@zodios/core";
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

export type BffGetCatalogApiQueryParam = ZodiosQueryParamsByPath<
  BffApi,
  "get",
  "/catalog"
>;

export type BffCatalogApiEService = z.infer<typeof schemas.CatalogEService>;
export type BffCatalogApiProducerEService = z.infer<
  typeof schemas.ProducerEService
>;

export type BffCatalogApiEServiceDoc = z.infer<typeof schemas.EServiceDoc>;

export type BffCatalogApiProducersEServiceDescriptorResponse =
  ZodiosResponseByPath<
    BffApi,
    "get",
    "/producers/eservices/:eserviceId/descriptors/:descriptorId"
  >;

export type BffCatalogApiProducerEServiceDescriptor = z.infer<
  typeof schemas.ProducerEServiceDescriptor
>;

export type BffCatalogApiProducerDescriptorEService = z.infer<
  typeof schemas.ProducerDescriptorEService
>;

export type BffCatalogApiCompactDescriptor = z.infer<
  typeof schemas.CompactDescriptor
>;

export type BffCatalogApiProducerEServiceRiskAnalysis = z.infer<
  typeof schemas.EServiceRiskAnalysis
>;

export type BffCatalogApiProducerRiskAnalysisForm = z.infer<
  typeof schemas.RiskAnalysisForm
>;

export type BffCatalogApiDescriptorAttribute = z.infer<
  typeof schemas.DescriptorAttribute
>;
