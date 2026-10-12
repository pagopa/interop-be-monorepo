import { createSelectSchema } from "drizzle-zod";
import { tenantVerifiedAttributeVerifierInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const TenantVerifiedAttributeVerifierSchema = createSelectSchema(
  tenantVerifiedAttributeVerifierInReadmodelTenant
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantVerifiedAttributeVerifierSchema = z.infer<
  typeof TenantVerifiedAttributeVerifierSchema
>;
