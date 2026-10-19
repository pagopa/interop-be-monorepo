import { TenantMailSchema } from "pagopa-interop-kpi-models";
import { z } from "zod";

export const TenantMailDeletingSchema = TenantMailSchema.pick({
  id: true,
  tenantId: true,
  deleted: true,
});
export type TenantMailDeletingSchema = z.infer<typeof TenantMailDeletingSchema>;
