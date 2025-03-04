import { and, eq, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { TenantId } from "pagopa-interop-models";
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
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

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type TransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

const updateTenantVersionInRelatedTable = async (
  tx: TransactionType,
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

export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
