import { ZodiosResponseByPath } from "@zodios/core";
import { z } from "zod";
import { api as bff, schemas } from "../generated/api.js";

export type BffApi = typeof bff.api;

export type BffApiEService = z.infer<typeof schemas.CatalogEService>;
export type BffApiPurposes = z.infer<typeof schemas.Purposes>;
export type BffApiPurpose = z.infer<typeof schemas.Purpose>;
export type BffApiPurposeVersionResource = z.infer<
  typeof schemas.PurposeVersionResource
>;

export type Test = ZodiosResponseByPath<
  BffApi,
  "get",
  "/purpose/:purposeId/versions/:versionId/documents/:documentId"
>;
