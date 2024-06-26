import { ZodiosBodyByPath, ZodiosResponseByPath } from "@zodios/core";
import { api as purposeApi } from "./generated/purpose-process/api.js";

type PurposeApi = typeof purposeApi.api;

export type ApiUpdateReversePurposePayload = ZodiosBodyByPath<
  PurposeApi,
  "post",
  "/reverse/purposes/:id"
>;
export type VersionState = ZodiosResponseByPath<
  PurposeApi,
  "post",
  "/reverse/purposes/:id"
>["versions"][number]["state"];
