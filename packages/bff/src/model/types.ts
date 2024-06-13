import { ZodiosBodyByPath } from "@zodios/core";
import { api as purposeApi } from "./generated/purpose-process/api.js";

type PurposeApi = typeof purposeApi.api;

export type ApiUpdateReversePurposePayload = ZodiosBodyByPath<
  PurposeApi,
  "post",
  "/reverse/purposes/:id"
>;
