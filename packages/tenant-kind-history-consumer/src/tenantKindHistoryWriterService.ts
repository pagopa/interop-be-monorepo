import { eq } from "drizzle-orm";
import { fromTenantKindHistorySQL } from "pagopa-interop-models";
import {
  checkMetadataVersion,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceTemplateInReadmodelEserviceTemplate,
} from "pagopa-interop-readmodel-models";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantKindHistoryWriterServiceBuilder(
  tenantKindHistoryDB: DrizzleReturnType
) {
  return {
    async createTenantKindHistory(
      tenantId: string,
      metadataVersion: number,
      kind: string,
      modifiedAt: string
    ): Promise<void> {
      const tenantKindHistorySQL = fromTenantKindHistorySQL({
        tenantId,
        metadataVersion,
        kind,
        modifiedAt,
      });

      await tenantKindHistoryDB
        .insert(tenantKindHistory)
        .values(tenantKindHistorySQL);

      await tenantKindHistoryDB.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          eserviceTemplateInReadmodelEserviceTemplate,
          metadataVersion,
          eserviceTemplate.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(eserviceTemplateInReadmodelEserviceTemplate)
          .where(
            eq(
              eserviceTemplateInReadmodelEserviceTemplate.id,
              eserviceTemplate.id
            )
          );
      });
    },
  };
}
export type TenantKindHistoryWriterService = ReturnType<
  typeof tenantKindHistoryWriterServiceBuilder
>;
