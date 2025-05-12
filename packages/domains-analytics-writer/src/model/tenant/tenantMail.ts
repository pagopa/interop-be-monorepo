import { z } from "zod";
import { TenantMailSQL } from "pagopa-interop-readmodel-models";

export const TenantMailSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  metadata_version: z.number(),
  kind: z.string(),
  address: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantMailSchema = z.infer<typeof TenantMailSchema>;

export type TenantMailMapping = {
  [K in keyof TenantMailSchema]: (record: TenantMailSQL) => TenantMailSchema[K];
};

export const TenantMailDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantMailDeletingSchema = z.infer<typeof TenantMailDeletingSchema>;

export type TenantMailDeletingMapping = {
  [K in keyof TenantMailDeletingSchema]: (
    record: TenantMailSQL
  ) => TenantMailDeletingSchema[K];
};
