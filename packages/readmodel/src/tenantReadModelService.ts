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
  toTenantAggregator,
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
    // TODO: getTenantById with joins is too slow. await Promise.all is faster.
    // async getTenantById(
    //   tenantId: TenantId
    // ): Promise<WithMetadata<Tenant> | undefined> {
    //   return await this.getTenantByFilter(
    //     eq(tenantInReadmodelTenant.id, tenantId),
    //     tenantId
    //   );
    // },
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
        await retrieveTenantSQL(eq(tenantInReadmodelTenant.id, tenantId), db),
        await retrieveTenantMailsSQL(
          eq(tenantMailInReadmodelTenant.tenantId, tenantId),
          db
        ),
        await retrieveTenantCertifiedAttributesSQL(
          eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId),
          db
        ),
        await retrieveTenantDeclaredAttributesSQL(
          eq(tenantDeclaredAttributeInReadmodelTenant.tenantId, tenantId),
          db
        ),
        await retrieveTenantVerifiedAttributesSQL(
          eq(tenantVerifiedAttributeInReadmodelTenant.tenantId, tenantId),
          db
        ),
        await retrieveTenantVerifiedAttributeVerifiersSQL(
          eq(
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
            tenantId
          ),
          db
        ),
        await retrieveTenantVerifiedAttributeRevokersSQL(
          eq(
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
            tenantId
          ),
          db
        ),
        await retrieveTenantFeaturesSQL(
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
    async getTenantByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Tenant> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      /*
      tenant  ->1 tenant_mail
				      ->2 tenant_certified_attribute
				      ->3 tenant_declared_attribute
				      ->4 tenant_verified_attribute ->5 tenant_verified_attribute_verifier
																		        ->6 tenant_verified_attribute_revoker
				      ->7 tenant_feature
      */
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
          // 1
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          // 2
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 3
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 4
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 5
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 6
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 7
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      // TODO how to ensure that this is used with filters that match always one tenant at most?
      return aggregateTenant(toTenantAggregator(queryResult));
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
export const retrieveTenantSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantSQL | undefined> => {
  const result = await db.select().from(tenantInReadmodelTenant).where(filter);
  return result[0];
};

export const retrieveTenantMailsSQL = async (
  filter: SQL | undefined,
  db: DrizzleReturnType
): Promise<TenantMailSQL[]> =>
  await db.select().from(tenantMailInReadmodelTenant).where(filter);

export const retrieveTenantCertifiedAttributesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantCertifiedAttributeSQL[]> =>
  await db
    .select()
    .from(tenantCertifiedAttributeInReadmodelTenant)
    .where(filter);

export const retrieveTenantDeclaredAttributesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantDeclaredAttributeSQL[]> =>
  await db
    .select()
    .from(tenantDeclaredAttributeInReadmodelTenant)
    .where(filter);

export const retrieveTenantVerifiedAttributesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeSQL[]> =>
  await db
    .select()
    .from(tenantVerifiedAttributeInReadmodelTenant)
    .where(filter);

export const retrieveTenantVerifiedAttributeVerifiersSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeVerifierSQL[]> =>
  await db
    .select()
    .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
    .where(filter);

export const retrieveTenantVerifiedAttributeRevokersSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantVerifiedAttributeRevokerSQL[]> =>
  await db
    .select()
    .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
    .where(filter);

export const retrieveTenantFeaturesSQL = async (
  filter: SQL,
  db: DrizzleReturnType
): Promise<TenantFeatureSQL[]> =>
  await db.select().from(tenantFeatureInReadmodelTenant).where(filter);
