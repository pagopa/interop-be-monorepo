import { and, eq, lte, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  genericInternalError,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
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
import { splitTenantIntoObjectsSQL } from "./tenant/splitters.js";
import {
  aggregateTenant,
  aggregateTenantArray,
  toTenantAggregator,
  toTenantAggregatorArray,
} from "./tenant/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantReadModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
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
      return await this.getTenantByFilter(
        eq(tenantInReadmodelTenant.id, tenantId)
      );
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
