import { and, eq, lte } from "drizzle-orm";
import {
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionId,
} from "pagopa-interop-models";
import {
  checkMetadataVersion,
  PurposeReadModelService,
  splitPurposeVersionIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: DrizzleReturnType,
  purposeReadModelService: PurposeReadModelService
) {
  const updateMetadataVersionInPurposeTables = async (
    tx: DrizzleTransactionType,
    purposeId: PurposeId,
    newMetadataVersion: number
  ): Promise<void> => {
    const purposeTables = [
      purposeInReadmodelPurpose,
      purposeRiskAnalysisFormInReadmodelPurpose,
      purposeRiskAnalysisAnswerInReadmodelPurpose,
      purposeVersionInReadmodelPurpose,
      purposeVersionDocumentInReadmodelPurpose,
    ];

    for (const table of purposeTables) {
      await tx
        .update(table)
        .set({ metadataVersion: newMetadataVersion })
        .where(
          and(
            eq("purposeId" in table ? table.purposeId : table.id, purposeId),
            lte(table.metadataVersion, newMetadataVersion)
          )
        );
    }
  };

  return {
    async upsertPurpose(
      purpose: Purpose,
      metadataVersion: number
    ): Promise<void> {
      await purposeReadModelService.upsertPurpose(purpose, metadataVersion);
    },

    async deletePurposeById(
      purposeId: PurposeId,
      version: number
    ): Promise<void> {
      await purposeReadModelService.deletePurposeById(purposeId, version);
    },

    async upsertPurposeVersion(
      purposeId: PurposeId,
      purposeVersion: PurposeVersion,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          purposeInReadmodelPurpose,
          metadataVersion,
          purposeId
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(purposeVersionInReadmodelPurpose)
          .where(eq(purposeVersionInReadmodelPurpose.id, purposeVersion.id));

        const { versionSQL, versionDocumentSQL } =
          splitPurposeVersionIntoObjectsSQL(
            purposeId,
            purposeVersion,
            metadataVersion
          );

        await tx.insert(purposeVersionInReadmodelPurpose).values(versionSQL);
        if (versionDocumentSQL) {
          await tx
            .insert(purposeVersionDocumentInReadmodelPurpose)
            .values(versionDocumentSQL);
        }

        await updateMetadataVersionInPurposeTables(
          tx,
          purposeId,
          metadataVersion
        );
      });
    },

    async deletePurposeVersionById(
      purposeId: PurposeId,
      purposeVersionId: PurposeVersionId,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(purposeVersionInReadmodelPurpose)
          .where(
            and(
              eq(purposeVersionInReadmodelPurpose.id, purposeVersionId),
              lte(
                purposeVersionInReadmodelPurpose.metadataVersion,
                metadataVersion
              )
            )
          );

        await updateMetadataVersionInPurposeTables(
          tx,
          purposeId,
          metadataVersion
        );
      });
    },
  };
}
export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
