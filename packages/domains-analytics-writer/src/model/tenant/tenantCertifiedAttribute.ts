import { z } from "zod";
import { tenantCertifiedAttributeInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { createSelectSchema } from "drizzle-zod";

export const TenantCertifiedAttributeSchema = createSelectSchema(
  tenantCertifiedAttributeInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantCertifiedAttributeSchema = z.infer<
  typeof TenantCertifiedAttributeSchema
>;
