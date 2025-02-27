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
  aggregateTenantSQL,
  fromJoinToAggregator,
} from "./tenant/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelTenantServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async upsertTenant(tenant: WithMetadata<Tenant>): Promise<void> {
      const {
        tenantSQL,
        tenantMailsSQL,
        tenantCertifiedAttributesSQL,
        tenantDeclaredAttributesSQL,
        tenantVerifiedAttributesSQL,
        tenantVerifiedAttributeVerifiersSQL,
        tenantVerifiedAttributeRevokersSQL,
        tenantFeaturesSQL,
      } = splitTenantIntoObjectsSQL(tenant.data, tenant.metadata.version);

      await db.transaction(async (tx) => {
        await tx
          .delete(tenantInReadmodelTenant)
          .where(eq(tenantInReadmodelTenant.id, tenant.data.id));

        await tx.insert(tenantInReadmodelTenant).values(tenantSQL);

        for (const mail of tenantMailsSQL) {
          await tx.insert(tenantMailInReadmodelTenant).values(mail);
        }

        for (const certifiedAttr of tenantCertifiedAttributesSQL) {
          await tx
            .insert(tenantCertifiedAttributeInReadmodelTenant)
            .values(certifiedAttr);
        }

        for (const declaredAttr of tenantDeclaredAttributesSQL) {
          await tx
            .insert(tenantDeclaredAttributeInReadmodelTenant)
            .values(declaredAttr);
        }

        for (const verifiedAttr of tenantVerifiedAttributesSQL) {
          await tx
            .insert(tenantVerifiedAttributeInReadmodelTenant)
            .values(verifiedAttr);
        }

        for (const verifier of tenantVerifiedAttributeVerifiersSQL) {
          await tx
            .insert(tenantVerifiedAttributeVerifierInReadmodelTenant)
            .values(verifier);
        }

        for (const revoker of tenantVerifiedAttributeRevokersSQL) {
          await tx
            .insert(tenantVerifiedAttributeRevokerInReadmodelTenant)
            .values(revoker);
        }

        for (const feature of tenantFeaturesSQL) {
          await tx.insert(tenantFeatureInReadmodelTenant).values(feature);
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

      const aggregatorInput = fromJoinToAggregator(queryResult);

      return aggregateTenantSQL(aggregatorInput);
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

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

export type ReadModelTenantService = ReturnType<
  typeof readModelTenantServiceBuilder
>;

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
