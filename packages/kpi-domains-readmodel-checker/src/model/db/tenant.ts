import {
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { TenantSchema } from "../tenant/tenant.js";
import { TenantCertifiedAttributeSchema } from "../tenant/tenantCertifiedAttribute.js";
import { TenantDeclaredAttributeSchema } from "../tenant/tenantDeclaredAttribute.js";
import { TenantFeatureSchema } from "../tenant/tenantFeature.js";
import { TenantMailSchema } from "../tenant/tenantMail.js";
import { TenantVerifiedAttributeSchema } from "../tenant/tenantVerifiedAttribute.js";
import { TenantVerifiedAttributeRevokerSchema } from "../tenant/tenantVerifiedAttributeRevoker.js";
import { TenantVerifiedAttributeVerifierSchema } from "../tenant/tenantVerifiedAttributeVerifier.js";

export const TenantDbTableConfig = {
  tenant: TenantSchema,
  tenant_mail: TenantMailSchema,
  tenant_certified_attribute: TenantCertifiedAttributeSchema,
  tenant_declared_attribute: TenantDeclaredAttributeSchema,
  tenant_verified_attribute: TenantVerifiedAttributeSchema,
  tenant_verified_attribute_verifier: TenantVerifiedAttributeVerifierSchema,
  tenant_verified_attribute_revoker: TenantVerifiedAttributeRevokerSchema,
  tenant_feature: TenantFeatureSchema,
} as const;
export type TenantDbTableConfig = typeof TenantDbTableConfig;

export const TenantDbTableReadModel = {
  tenant: tenantInReadmodelTenant,
  tenant_mail: tenantMailInReadmodelTenant,
  tenant_certified_attribute: tenantCertifiedAttributeInReadmodelTenant,
  tenant_declared_attribute: tenantDeclaredAttributeInReadmodelTenant,
  tenant_verified_attribute: tenantVerifiedAttributeInReadmodelTenant,
  tenant_verified_attribute_verifier:
    tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenant_verified_attribute_revoker:
    tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenant_feature: tenantFeatureInReadmodelTenant,
} as const;
export type TenantDbTableReadModel = typeof TenantDbTableReadModel;

export type TenantDbTable = keyof typeof TenantDbTableConfig;
export const TenantDbTable: { [K in TenantDbTable]: K } = Object.fromEntries(
  Object.keys(TenantDbTableConfig).map((k) => [k, k])
) as { [K in TenantDbTable]: K };
