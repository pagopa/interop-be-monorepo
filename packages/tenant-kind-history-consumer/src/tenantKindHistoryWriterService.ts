import { eq, and } from "drizzle-orm";
import {
  TenantKind,
  toTenantKindHistorySQL,
  unsafeBrandId,
} from "pagopa-interop-models";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";
import { drizzle } from "drizzle-orm/node-postgres";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantKindHistoryWriterServiceBuilder(
  tenantKindHistoryDB: ReturnType<typeof drizzle>
) {
  return {
    async createTenantKindHistory(
      tenantId: string,
      metadataVersion: number,
      kind: string | undefined,
      modifiedAt: Date
    ): Promise<void> {
      if (!kind) return; // no tenant kind change to register

      const tenantKindHistorySQL = toTenantKindHistorySQL({
        tenantId: unsafeBrandId(tenantId),
        version: metadataVersion,
        kind: TenantKind.parse(kind),
        modifiedAt: modifiedAt,
      });

      await tenantKindHistoryDB.transaction(async (tx) => {
        const match = await tx
          .select()
          .from(tenantKindHistory)
          .where(
            and(
              eq(tenantKindHistory.tenantId, tenantKindHistorySQL.tenantId),
              eq(
                tenantKindHistory.metadataVersion,
                tenantKindHistorySQL.metadataVersion
              )
            )
          );

        if (match) return; // already saved this tenant kind change

        await tx.insert(tenantKindHistory).values(tenantKindHistorySQL);
      });
    },
  };
}
export type TenantKindHistoryWriterService = ReturnType<
  typeof tenantKindHistoryWriterServiceBuilder
>;
