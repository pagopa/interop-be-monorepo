import { z } from "zod";
import { TenantSchema } from "pagopa-interop-kpi-models";

export const TenantSelfcareIdSchema = TenantSchema.pick({
  id: true,
  selfcareId: true,
  metadataVersion: true,
  deleted: true,
});
export type TenantSelfcareIdSchema = z.infer<typeof TenantSelfcareIdSchema>;

export const TenantDeletingSchema = TenantSchema.pick({
  id: true,
  deleted: true,
});
export type TenantDeletingSchema = z.infer<typeof TenantDeletingSchema>;
