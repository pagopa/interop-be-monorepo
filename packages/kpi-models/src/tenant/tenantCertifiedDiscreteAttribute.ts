import { createSelectSchema } from "drizzle-zod";
import { tenantCertifiedDiscreteAttributeInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantCertifiedDiscreteAttributeSchema = createSelectSchema(
  tenantCertifiedDiscreteAttributeInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantCertifiedDiscreteAttributeSchema = z.infer<
  typeof TenantCertifiedDiscreteAttributeSchema
>;
