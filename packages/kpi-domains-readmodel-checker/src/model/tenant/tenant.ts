import { tenantInReadmodelTenant } from "pagopa-interop-readmodel-models";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { TenantCertifiedAttributeSchema } from "./tenantCertifiedAttribute.js";
import { TenantDeclaredAttributeSchema } from "./tenantDeclaredAttribute.js";
import { TenantFeatureSchema } from "./tenantFeature.js";
import { TenantMailSchema } from "./tenantMail.js";
import { TenantVerifiedAttributeSchema } from "./tenantVerifiedAttribute.js";
import { TenantVerifiedAttributeRevokerSchema } from "./tenantVerifiedAttributeRevoker.js";
import { TenantVerifiedAttributeVerifierSchema } from "./tenantVerifiedAttributeVerifier.js";

export const TenantSchema = createSelectSchema(tenantInReadmodelTenant).extend({
  deleted: z.boolean().default(false).optional(),
});
export type TenantSchema = z.infer<typeof TenantSchema>;

export const TenantItemsSchema = z.object({
  tenantSQL: TenantSchema,
  mailsSQL: z.array(TenantMailSchema),
  certifiedAttributesSQL: z.array(TenantCertifiedAttributeSchema),
  declaredAttributesSQL: z.array(TenantDeclaredAttributeSchema),
  verifiedAttributesSQL: z.array(TenantVerifiedAttributeSchema),
  verifiedAttributeVerifiersSQL: z.array(TenantVerifiedAttributeVerifierSchema),
  verifiedAttributeRevokersSQL: z.array(TenantVerifiedAttributeRevokerSchema),
  featuresSQL: z.array(TenantFeatureSchema),
});
export type TenantItemsSchema = z.infer<typeof TenantItemsSchema>;
