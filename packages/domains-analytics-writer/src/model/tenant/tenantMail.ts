import { z } from "zod";
import { TenantMailSchema } from "pagopa-interop-kpi-models";

export const TenantMailDeletingSchema = TenantMailSchema.pick({
  id: true,
  tenantId: true,
  deleted: true,
});
export type TenantMailDeletingSchema = z.infer<typeof TenantMailDeletingSchema>;
