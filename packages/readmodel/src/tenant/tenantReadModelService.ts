import { eq, inArray, SQL } from "drizzle-orm";
import {
  Tenant,
  TenantId,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
  tenantCertifiedAttributeInReadmodelTenant,
  TenantCertifiedAttributeSQL,
  tenantDeclaredAttributeInReadmodelTenant,
  TenantDeclaredAttributeSQL,
  tenantFeatureInReadmodelTenant,
  TenantFeatureSQL,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  TenantMailSQL,
  TenantSQL,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-readmodel-models";
import { ascLower } from "pagopa-interop-commons";
import { aggregateTenant, aggregateTenantArray } from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getTenantById(
      tenantId: TenantId,
      tx?: DrizzleTransactionType
    ): Promise<WithMetadata<Tenant> | undefined> {
      const executeInTransaction = async (
        tx: DrizzleTransactionType
      ): Promise<WithMetadata<Tenant> | undefined> => {
        const [
          tenantSQL,
          mailsSQL,
          certifiedAttributesSQL,
          declaredAttributesSQL,
          verifiedAttributesSQL,
          verifiedAttributeVerifiersSQL,
          verifiedAttributeRevokersSQL,
          featuresSQL,
        ] = await Promise.all([
          readTenantSQL(eq(tenantInReadmodelTenant.id, tenantId), tx),
          readTenantMailsSQL(
            eq(tenantMailInReadmodelTenant.tenantId, tenantId),
            tx
          ),
          readTenantCertifiedAttributesSQL(
            eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId),
            tx
          ),
          readTenantDeclaredAttributesSQL(
            eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId),
            tx
          ),
          readTenantVerifiedAttributesSQL(
            eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId),
            tx
          ),
          readTenantVerifiedAttributeVerifiersSQL(
            eq(
              tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
              tenantId
            ),
            tx
          ),
          readTenantVerifiedAttributeRevokersSQL(
            eq(
              tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
              tenantId
            ),
            tx
          ),
          readTenantFeaturesSQL(
            eq(tenantFeatureInReadmodelTenant.tenantId, tenantId),
            tx
          ),
        ]);

        if (!tenantSQL) {
          return undefined;
        }
        return aggregateTenant({
          tenantSQL,
          mailsSQL,
          certifiedAttributesSQL,
          declaredAttributesSQL,
          verifiedAttributesSQL,
          verifiedAttributeVerifiersSQL,
          verifiedAttributeRevokersSQL,
          featuresSQL,
        });
      };
      return tx
        ? executeInTransaction(tx)
        : db.transaction((tx) => executeInTransaction(tx));
    },
    async getTenantsByIds(
      tenantIds: string[],
      tx: DrizzleTransactionType
    ): Promise<Array<WithMetadata<Tenant>>> {
      const [
        tenantsSQL,
        mailsSQL,
        certifiedAttributesSQL,
        declaredAttributesSQL,
        verifiedAttributesSQL,
        verifiedAttributeVerifiersSQL,
        verifiedAttributeRevokersSQL,
        featuresSQL,
      ] = await Promise.all([
        readTenantsSQL(inArray(tenantInReadmodelTenant.id, tenantIds), tx),
        readTenantMailsSQL(
          inArray(tenantMailInReadmodelTenant.tenantId, tenantIds),
          tx
        ),
        readTenantCertifiedAttributesSQL(
          inArray(
            tenantCertifiedAttributeInReadmodelTenant.tenantId,
            tenantIds
          ),
          tx
        ),
        readTenantDeclaredAttributesSQL(
          inArray(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantIds),
          tx
        ),
        readTenantVerifiedAttributesSQL(
          inArray(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantIds),
          tx
        ),
        readTenantVerifiedAttributeVerifiersSQL(
          inArray(
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
            tenantIds
          ),
          tx
        ),
        readTenantVerifiedAttributeRevokersSQL(
          inArray(
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
            tenantIds
          ),
          tx
        ),
        readTenantFeaturesSQL(
          inArray(tenantFeatureInReadmodelTenant.tenantId, tenantIds),
          tx
        ),
      ]);

      return aggregateTenantArray({
        tenantsSQL,
        mailsSQL,
        certifiedAttributesSQL,
        declaredAttributesSQL,
        verifiedAttributesSQL,
        verifiedAttributeVerifiersSQL,
        verifiedAttributeRevokersSQL,
        featuresSQL,
      });
    },
    async getTenantByCertifierId(
      certifierId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return db.transaction(async (tx) => {
        const feature = await readTenantFeaturesSQL(
          eq(tenantFeatureInReadmodelTenant.certifierId, certifierId),
          tx
        );
        if (feature.length === 0) {
          return undefined;
        }
        const tenantId = unsafeBrandId<TenantId>(feature[0].tenantId);
        return this.getTenantById(tenantId, tx);
      });
    },
  };
}
export type TenantReadModelService = ReturnType<
  typeof tenantReadModelServiceBuilder
>;

// these are used for getTenantByid with await Promise.all.
const readTenantSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantSQL | undefined> => {
  const result = await tx.select().from(tenantInReadmodelTenant).where(filter);
  return result[0];
};

const readTenantsSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantSQL[]> =>
  await tx
    .select()
    .from(tenantInReadmodelTenant)
    .where(filter)
    .orderBy(ascLower(tenantInReadmodelTenant.name));

const readTenantMailsSQL = async (
  filter: SQL | undefined,
  tx: DrizzleTransactionType
): Promise<TenantMailSQL[]> =>
  await tx.select().from(tenantMailInReadmodelTenant).where(filter);

const readTenantCertifiedAttributesSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantCertifiedAttributeSQL[]> =>
  await tx
    .select()
    .from(tenantCertifiedAttributeInReadmodelTenant)
    .where(filter);

const readTenantDeclaredAttributesSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantDeclaredAttributeSQL[]> =>
  await tx
    .select()
    .from(tenantDeclaredAttributeInReadmodelTenant)
    .where(filter);

const readTenantVerifiedAttributesSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantVerifiedAttributeSQL[]> =>
  await tx
    .select()
    .from(tenantVerifiedAttributeInReadmodelTenant)
    .where(filter);

const readTenantVerifiedAttributeVerifiersSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantVerifiedAttributeVerifierSQL[]> =>
  await tx
    .select()
    .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
    .where(filter);

const readTenantVerifiedAttributeRevokersSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantVerifiedAttributeRevokerSQL[]> =>
  await tx
    .select()
    .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
    .where(filter);

const readTenantFeaturesSQL = async (
  filter: SQL,
  tx: DrizzleTransactionType
): Promise<TenantFeatureSQL[]> =>
  await tx.select().from(tenantFeatureInReadmodelTenant).where(filter);
