import { and, eq, lte } from "drizzle-orm";
import { Tenant, TenantId, WithMetadata } from "pagopa-interop-models";
import { TenantReadModelService } from "pagopa-interop-readmodel";
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
export function readModelServiceBuilder(
  db: DrizzleReturnType,
  tenantReadModelService: TenantReadModelService
) {
  return {
    async upsertTenant(tenant: Tenant, metadataVersion: number): Promise<void> {
      return await tenantReadModelService.upsertTenant(tenant, metadataVersion);
    },
    async getTenantById(
      tenantId: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return await tenantReadModelService.getTenantById(tenantId);
    },
    async deleteTenant(
      tenantId: TenantId,
      metadataVersion: number
    ): Promise<void> {
      return await tenantReadModelService.deleteTenantById(
        tenantId,
        metadataVersion
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

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
