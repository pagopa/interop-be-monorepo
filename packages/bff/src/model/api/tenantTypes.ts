import { z } from "zod";
import { api as tenant, schemas } from "../generated/tenant-process/api.js";

export type TenantProcessClientApi = typeof tenant.api;
export type TenantProcessApiTenant = z.infer<typeof schemas.Tenant>;
export type TenantProcessApiTenantAttribute = z.infer<
  typeof schemas.TenantAttribute
>;
