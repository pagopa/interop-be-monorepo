import { tenantInReadmodelTenant } from "pagopa-interop-readmodel-models";
import {
  TenantSchema,
  TenantCertifiedAttributeSchema,
  TenantDeclaredAttributeSchema,
  TenantFeatureSchema,
  TenantMailSchema,
  TenantVerifiedAttributeSchema,
  TenantVerifiedAttributeRevokerSchema,
  TenantVerifiedAttributeVerifierSchema,
} from "pagopa-interop-kpi-models";
import { TenantSelfcareIdSchema } from "../tenant/tenant.js";

export const TenantDbPartialTableConfig = {
  tenant_self_care_id: TenantSelfcareIdSchema,
} as const;
export type TenantDbPartialTableConfig = typeof TenantDbPartialTableConfig;

export const TenantDbPartialTableReadModel = {
  tenant_self_care_id: tenantInReadmodelTenant,
} as const;
export type TenantDbPartialTableReadModel =
  typeof TenantDbPartialTableReadModel;

export type TenantDbPartialTable = keyof typeof TenantDbPartialTableConfig;
export const TenantDbPartialTable = Object.fromEntries(
  Object.keys(TenantDbPartialTableConfig).map((k) => [k, k])
) as { [K in TenantDbPartialTable]: K };

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

export type TenantDbTable = keyof typeof TenantDbTableConfig;
export const TenantDbTable: { [K in TenantDbTable]: K } = Object.fromEntries(
  Object.keys(TenantDbTableConfig).map((k) => [k, k])
) as { [K in TenantDbTable]: K };
