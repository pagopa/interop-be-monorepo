import { z } from "zod";
import { tenantCertifiedDiscreteAttributeInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { createSelectSchema } from "drizzle-zod";

export const TenantCertifiedDiscreteAttributeSchema = createSelectSchema(
  tenantCertifiedDiscreteAttributeInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantCertifiedDiscreteAttributeSchema = z.infer<
  typeof TenantCertifiedDiscreteAttributeSchema
>;
