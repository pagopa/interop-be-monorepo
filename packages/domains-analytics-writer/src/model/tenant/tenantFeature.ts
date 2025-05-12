import { z } from "zod";
import { TenantFeatureSQL } from "pagopa-interop-readmodel-models";

export const TenantFeatureSchema = z.object({
  tenant_id: z.string(),
  metadata_version: z.number(),
  kind: z.string(),
  certifier_id: z.string().nullable(),
  availability_timestamp: z.string().nullable(),
  deleted: z.boolean().default(false),
});

export type TenantFeatureSchema = z.infer<typeof TenantFeatureSchema>;

export type TenantFeatureMapping = {
  [K in keyof TenantFeatureSchema]: (
    record: TenantFeatureSQL
  ) => TenantFeatureSchema[K];
};

export const TenantFeatureDeletingSchema = z.object({
  tenant_id: z.string(),
  kind: z.string(),
  deleted: z.boolean().default(false),
});
export type TenantFeatureDeletingSchema = z.infer<
  typeof TenantFeatureDeletingSchema
>;

export type TenantFeatureDeletingMapping = {
  [K in keyof TenantFeatureDeletingSchema]: (
    record: TenantFeatureSQL
  ) => TenantFeatureDeletingSchema[K];
};
