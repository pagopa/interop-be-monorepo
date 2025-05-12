import { TenantSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  kind: z.string().nullable(),
  selfcare_id: z.string().nullable(),
  external_id_origin: z.string(),
  external_id_value: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  name: z.string(),
  onboarded_at: z.string().nullable(),
  sub_unit_type: z.string().nullable(),
  deleted: z.boolean().default(false),
});
export type TenantSchema = z.infer<typeof TenantSchema>;

export type TenantMapping = {
  [K in keyof TenantSchema]: (record: TenantSQL) => TenantSchema[K];
};

export const TenantDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantDeletingSchema = z.infer<typeof TenantDeletingSchema>;

export type TenantDeletingMapping = {
  [K in keyof TenantDeletingSchema]: (
    record: TenantSQL
  ) => TenantDeletingSchema[K];
};
