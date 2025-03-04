import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Tenant, TenantId, WithMetadata } from "pagopa-interop-models";
import {
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { ReadModelSQLDbConfig } from "pagopa-interop-commons";
import { Pool } from "pg";
import { splitTenantIntoObjectsSQL } from "./tenant/splitters.js";
import {
  aggregateTenant,
  aggregateTenantArray,
  toTenantAggregator,
  toTenantAggregatorArray,
} from "./tenant/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantReadModelServiceBuilderSQL(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertTenant(tenant: WithMetadata<Tenant>): Promise<void> {
      const {
        tenantSQL,
        mailsSQL,
        certifiedAttributesSQL,
        declaredAttributesSQL,
        verifiedAttributesSQL,
        verifiedAttributeVerifiersSQL,
        verifiedAttributeRevokersSQL,
        featuresSQL,
      } = splitTenantIntoObjectsSQL(tenant.data, tenant.metadata.version);

      await db.transaction(async (tx) => {
        await tx
          .delete(tenantInReadmodelTenant)
          .where(eq(tenantInReadmodelTenant.id, tenant.data.id));

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
    async getTenantById(tenantId: TenantId): Promise<WithMetadata<Tenant>> {
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
          verifiedAttribute: tenantVerifiedAttributeVerifierInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .where(eq(tenantInReadmodelTenant.id, tenantId))
        .leftJoin(
          // 1
          tenantInReadmodelTenant,
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

      const aggregatorInput = toTenantAggregator(queryResult);

      return aggregateTenant(aggregatorInput);
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
    async getAllTenants(): Promise<Array<WithMetadata<Tenant>>> {
      const queryResult = await db
        .select({
          tenant: tenantInReadmodelTenant,
          mail: tenantMailInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          declaredAttribute: tenantDeclaredAttributeInReadmodelTenant,
          verifiedAttribute: tenantVerifiedAttributeVerifierInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          // 1
          tenantInReadmodelTenant,
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

      const aggregatorInput = toTenantAggregatorArray(queryResult);

      return aggregateTenantArray(aggregatorInput);
    },
  };
}

export type TenantReadModelServiceSQL = ReturnType<
  typeof tenantReadModelServiceBuilderSQL
>;

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

export const makeDrizzleConnection = (
  readModelSQLDbConfig: ReadModelSQLDbConfig
): ReturnType<typeof drizzle> => {
  const pool = new Pool({
    host: readModelSQLDbConfig.readModelSQLDbHost,
    port: readModelSQLDbConfig.readModelSQLDbPort,
    database: readModelSQLDbConfig.readModelSQLDbName,
    user: readModelSQLDbConfig.readModelSQLDbUsername,
    password: readModelSQLDbConfig.readModelSQLDbPassword,
    ssl: readModelSQLDbConfig.readModelSQLDbUseSSL,
  });
  return drizzle({ client: pool });
};
