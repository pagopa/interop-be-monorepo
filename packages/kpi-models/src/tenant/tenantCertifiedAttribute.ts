import { createSelectSchema } from "drizzle-zod";
import { tenantCertifiedAttributeInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantCertifiedAttributeSchema = createSelectSchema(
  tenantCertifiedAttributeInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantCertifiedAttributeSchema = z.infer<
  typeof TenantCertifiedAttributeSchema
>;
