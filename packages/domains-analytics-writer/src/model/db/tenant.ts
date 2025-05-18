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
import { extractProp } from "../../db/dbModelMetadataExtractor.js";
import { TenantSchema } from "../tenant/tenant.js";
import { TenantCertifiedAttributeSchema } from "../tenant/tenantCertifiedAttribute.js";
import { TenantDeclaredAttributeSchema } from "../tenant/tenantDeclaredAttribute.js";
import { TenantFeatureSchema } from "../tenant/tenantFeature.js";
import { TenantMailSchema } from "../tenant/tenantMail.js";
import { TenantVerifiedAttributeSchema } from "../tenant/tenantVerifiedAttribute.js";
import { TenantVerifiedAttributeRevokerSchema } from "../tenant/tenantVerifiedAttributeRevoker.js";
import { TenantVerifiedAttributeVerifierSchema } from "../tenant/tenantVerifiedAttributeVerifier.js";

const TenantTableMeta = {
  tenant: { schema: TenantSchema, readModel: tenantInReadmodelTenant },
  tenant_mail: {
    schema: TenantMailSchema,
    readModel: tenantMailInReadmodelTenant,
  },
  tenant_certified_attribute: {
    schema: TenantCertifiedAttributeSchema,
    readModel: tenantCertifiedAttributeInReadmodelTenant,
  },
  tenant_declared_attribute: {
    schema: TenantDeclaredAttributeSchema,
    readModel: tenantDeclaredAttributeInReadmodelTenant,
  },
  tenant_verified_attribute: {
    schema: TenantVerifiedAttributeSchema,
    readModel: tenantVerifiedAttributeInReadmodelTenant,
  },
  tenant_verified_attribute_verifier: {
    schema: TenantVerifiedAttributeVerifierSchema,
    readModel: tenantVerifiedAttributeVerifierInReadmodelTenant,
  },
  tenant_verified_attribute_revoker: {
    schema: TenantVerifiedAttributeRevokerSchema,
    readModel: tenantVerifiedAttributeRevokerInReadmodelTenant,
  },
  tenant_feature: {
    schema: TenantFeatureSchema,
    readModel: tenantFeatureInReadmodelTenant,
  },
} as const;

export const TenantDbTableConfig = extractProp(TenantTableMeta, "schema");
export type TenantDbTableConfig = typeof TenantDbTableConfig;

export const TenantDbTableReadModel = extractProp(TenantTableMeta, "readModel");
export type TenantDbTableReadModel = typeof TenantDbTableReadModel;

export type TenantDbTable = keyof typeof TenantDbTableConfig;
export const TenantDbTable = Object.fromEntries(
  Object.keys(TenantDbTableConfig).map((k) => [k, k])
) as { [K in TenantDbTable]: K };
