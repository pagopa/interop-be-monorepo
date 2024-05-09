import { ZodiosBodyByPath } from "@zodios/core";
import { api } from "./generated/api.js";

type Api = typeof api.api;
export type ApiSelfcareTenantSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/selfcare/tenants"
>;
export type ApiM2MTenantSeed = ZodiosBodyByPath<Api, "post", "/m2m/tenants">;
