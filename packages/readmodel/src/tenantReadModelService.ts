import { and, eq, lte, SQL } from "drizzle-orm";
import {
  genericInternalError,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
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
import { splitTenantIntoObjectsSQL } from "./tenant/splitters.js";
import {
  aggregateTenant,
  aggregateTenantArray,
  toTenantAggregatorArray,
} from "./tenant/aggregators.js";
import { checkMetadataVersion } from "./index.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async upsertTenant(tenant: Tenant, metadataVersion: number): Promise<void> {
      const {
        tenantSQL,
        mailsSQL,
        certifiedAttributesSQL,
        declaredAttributesSQL,
        verifiedAttributesSQL,
        verifiedAttributeVerifiersSQL,
        verifiedAttributeRevokersSQL,
        featuresSQL,
      } = splitTenantIntoObjectsSQL(tenant, metadataVersion);

      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          tenantInReadmodelTenant,
          metadataVersion,
          tenant.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(tenantInReadmodelTenant)
          .where(eq(tenantInReadmodelTenant.id, tenant.id));

        await tx.insert(tenantInReadmodelTenant).values(tenantSQL);

        for (const mailSQL of mailsSQL) {
          await tx.insert(tenantMailInReadmodelTenant).values(mailSQL);
        }

        for (const certifiedAttributeSQL of certifiedAttributesSQL) {
          await tx
            .insert(tenantCertifiedAttributeInReadmodelTenant)
            .values(certifiedAttributeSQL);
        }

        for (const declaredAttributeSQL of declaredAttributesSQL) {
          await tx
            .insert(tenantDeclaredAttributeInReadmodelTenant)
            .values(declaredAttributeSQL);
        }

        for (const verifiedAttributeSQL of verifiedAttributesSQL) {
          await tx
            .insert(tenantVerifiedAttributeInReadmodelTenant)
            .values(verifiedAttributeSQL);
        }

        for (const verifierSQL of verifiedAttributeVerifiersSQL) {
          await tx
            .insert(tenantVerifiedAttributeVerifierInReadmodelTenant)
            .values(verifierSQL);
        }

        for (const revokerSQL of verifiedAttributeRevokersSQL) {
          await tx
            .insert(tenantVerifiedAttributeRevokerInReadmodelTenant)
            .values(revokerSQL);
        }

        for (const featureSQL of featuresSQL) {
          await tx.insert(tenantFeatureInReadmodelTenant).values(featureSQL);
        }
      });
    },
    async getTenantById(
      tenantId: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
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
        readTenantSQL(eq(tenantInReadmodelTenant.id, tenantId), db),
        readTenantMailsSQL(
          eq(tenantMailInReadmodelTenant.tenantId, tenantId),
          db
        ),
        readTenantCertifiedAttributesSQL(
          eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId),
          db
        ),
        readTenantDeclaredAttributesSQL(
          eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId),
          db
        ),
        readTenantVerifiedAttributesSQL(
          eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId),
          db
        ),
        readTenantVerifiedAttributeVerifiersSQL(
          eq(
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
            tenantId
          ),
          db
        ),
        readTenantVerifiedAttributeRevokersSQL(
          eq(
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
            tenantId
          ),
          db
        ),
        readTenantFeaturesSQL(
          eq(tenantFeatureInReadmodelTenant.tenantId, tenantId),
          db
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
    },
    async getTenantsByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Tenant>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          tenant: tenantInReadmodelTenant,
          mail: tenantMailInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          declaredAttribute: tenantDeclaredAttributeInReadmodelTenant,
          verifiedAttribute: tenantVerifiedAttributeInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .where(filter)
        .leftJoin(
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        );

      return aggregateTenantArray(toTenantAggregatorArray(queryResult));
    },
    async deleteTenantById(tenantId: TenantId, version: number): Promise<void> {
      await db
        .delete(tenantInReadmodelTenant)
        .where(
          and(
            eq(tenantInReadmodelTenant.id, tenantId),
            lte(tenantInReadmodelTenant.metadataVersion, version)
          )
        );
    },
  };
}

export type TenantReadModelService = ReturnType<
  typeof tenantReadModelServiceBuilder
>;

// TODO: these are used for getTenantByid with await Promise.all.
export const readTenantSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantSQL | undefined> => {
  const result = await db.select().from(tenantInReadmodelTenant).where(filter);
  return result[0];
};

export const readTenantMailsSQL = async (
  filter: SQL | undefined,
  db: DrizzleReturnType
): Promise<TenantMailSQL[]> =>
  await db.select().from(tenantMailInReadmodelTenant).where(filter);

export const readTenantCertifiedAttributesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantCertifiedAttributeSQL[]> =>
  await db
    .select()
    .from(tenantCertifiedAttributeInReadmodelTenant)
    .where(filter);

export const readTenantDeclaredAttributesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantDeclaredAttributeSQL[]> =>
  await db
    .select()
    .from(tenantDeclaredAttributeInReadmodelTenant)
    .where(filter);

export const readTenantVerifiedAttributesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeSQL[]> =>
  await db
    .select()
    .from(tenantVerifiedAttributeInReadmodelTenant)
    .where(filter);

export const readTenantVerifiedAttributeVerifiersSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeVerifierSQL[]> =>
  await db
    .select()
    .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
    .where(filter);

export const readTenantVerifiedAttributeRevokersSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeRevokerSQL[]> =>
  await db
    .select()
    .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
    .where(filter);

export const readTenantFeaturesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantFeatureSQL[]> =>
  await db.select().from(tenantFeatureInReadmodelTenant).where(filter);
