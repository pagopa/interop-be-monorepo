import { InferSelectModel } from "drizzle-orm";
import {
  tenantCertifiedAttributeInReadmodel,
  tenantDeclaredAttributeInReadmodel,
  tenantFeatureInReadmodel,
  tenantInReadmodel,
  tenantMailInReadmodel,
  tenantVerifiedAttributeInReadmodel,
  tenantVerifiedAttributeRevokerInReadmodel,
  tenantVerifiedAttributeVerifierInReadmodel,
} from "./drizzle/schema.js";

export type TenantSQL = InferSelectModel<typeof tenantInReadmodel>;
export type TenantMailSQL = InferSelectModel<typeof tenantMailInReadmodel>;
export type TenantCertifiedAttributeSQL = InferSelectModel<
  typeof tenantCertifiedAttributeInReadmodel
>;
export type TenantDeclaredAttributeSQL = InferSelectModel<
  typeof tenantDeclaredAttributeInReadmodel
>;
export type TenantVerifiedAttributeSQL = InferSelectModel<
  typeof tenantVerifiedAttributeInReadmodel
>;
export type TenantVerifiedAttributeVerifierSQL = InferSelectModel<
  typeof tenantVerifiedAttributeVerifierInReadmodel
>;
export type TenantVerifiedAttributeRevokerSQL = InferSelectModel<
  typeof tenantVerifiedAttributeRevokerInReadmodel
>;
export type TenantFeatureSQL = InferSelectModel<
  typeof tenantFeatureInReadmodel
>;
