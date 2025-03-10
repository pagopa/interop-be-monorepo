import {
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  TenantSQL,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  TenantMailSQL,
  TenantFeatureSQL,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { TenantId } from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

export const retrieveTenantSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantSQL | undefined> => {
  const result = await db
    .select()
    .from(tenantInReadmodelTenant)
    .where(eq(tenantInReadmodelTenant.id, tenantId));
  return result[0];
};

export const retrieveTenantMailsSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantMailSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantMailInReadmodelTenant)
    .where(eq(tenantMailInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantCertifiedAttributesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantCertifiedAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantCertifiedAttributeInReadmodelTenant)
    .where(eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantDeclaredAttributesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantDeclaredAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantDeclaredAttributeInReadmodelTenant)
    .where(eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantVerifiedAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeInReadmodelTenant)
    .where(eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributeVerifiersSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantVerifiedAttributeVerifierSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
    .where(
      eq(tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId, tenantId)
    );
  return result.length > 0 ? result : undefined;
};

export const retrieveTenantVerifiedAttributeRevokersSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantVerifiedAttributeRevokerSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
    .where(
      eq(tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId, tenantId)
    );
  return result.length > 0 ? result : undefined;
};

export const retrieveTenanFeaturesSQL = async (
  tenantId: TenantId,
  db: ReturnType<typeof drizzle>
): Promise<TenantFeatureSQL[] | undefined> => {
  const result = await db
    .select()
    .from(tenantFeatureInReadmodelTenant)
    .where(eq(tenantFeatureInReadmodelTenant.tenantId, tenantId));
  return result.length > 0 ? result : undefined;
};
