import { and, eq, lte } from "drizzle-orm";
import { Tenant, TenantId } from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitTenantIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantWriterServiceBuilder(db: DrizzleReturnType) {
  const updateTenantVersionInRelatedTable = async (
    tx: DrizzleTransactionType,
    tenantId: TenantId,
    newVersion: number
  ): Promise<void> => {
    const tenantRelatedTables = [
      tenantMailInReadmodelTenant,
      tenantCertifiedAttributeInReadmodelTenant,
      tenantDeclaredAttributeInReadmodelTenant,
      tenantVerifiedAttributeInReadmodelTenant,
      tenantVerifiedAttributeVerifierInReadmodelTenant,
      tenantVerifiedAttributeRevokerInReadmodelTenant,
      tenantFeatureInReadmodelTenant,
    ];
    await tx
      .update(tenantInReadmodelTenant)
      .set({ metadataVersion: newVersion })
      .where(
        and(
          eq(tenantInReadmodelTenant.id, tenantId),
          lte(tenantInReadmodelTenant.metadataVersion, newVersion)
        )
      );

    for (const table of tenantRelatedTables) {
      await tx
        .update(table)
        .set({ metadataVersion: newVersion })
        .where(
          and(
            eq(table.tenantId, tenantId),
            lte(table.metadataVersion, newVersion)
          )
        );
    }
  };

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
    async deleteTenantMailById(
      tenantId: TenantId,
      tenantMailId: string,
      version: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(tenantMailInReadmodelTenant)
          .where(
            and(
              eq(tenantMailInReadmodelTenant.id, tenantMailId),
              eq(tenantMailInReadmodelTenant.tenantId, tenantId),
              lte(tenantMailInReadmodelTenant.metadataVersion, version)
            )
          );

        await updateTenantVersionInRelatedTable(tx, tenantId, version);
      });
    },
    async setSelfcareId(
      tenantId: TenantId,
      selfcareId: string,
      version: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .update(tenantInReadmodelTenant)
          .set({ selfcareId })
          .where(
            and(
              eq(tenantInReadmodelTenant.id, tenantId),
              lte(tenantInReadmodelTenant.metadataVersion, version)
            )
          );

        await updateTenantVersionInRelatedTable(tx, tenantId, version);
      });
    },
  };
}

export type TenantWriterService = ReturnType<typeof tenantWriterServiceBuilder>;
