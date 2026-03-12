import { and, eq, lte } from "drizzle-orm";
import {
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionId,
} from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitPurposeIntoObjectsSQL,
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
  purposeVersionSignedDocumentInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeWriterServiceBuilder(db: DrizzleReturnType) {
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
      purposeVersionStampInReadmodelPurpose,
      purposeVersionSignedDocumentInReadmodelPurpose,
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
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          purposeInReadmodelPurpose,
          metadataVersion,
          purpose.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(purposeInReadmodelPurpose)
          .where(eq(purposeInReadmodelPurpose.id, purpose.id));

        const {
          purposeSQL,
          riskAnalysisFormSQL,
          riskAnalysisAnswersSQL,
          versionsSQL,
          versionDocumentsSQL,
          versionStampsSQL,
          versionSignedDocumentsSQL,
        } = splitPurposeIntoObjectsSQL(purpose, metadataVersion);

        await tx.insert(purposeInReadmodelPurpose).values(purposeSQL);

        if (riskAnalysisFormSQL) {
          await tx
            .insert(purposeRiskAnalysisFormInReadmodelPurpose)
            .values(riskAnalysisFormSQL);
        }

        if (riskAnalysisAnswersSQL) {
          for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
            await tx
              .insert(purposeRiskAnalysisAnswerInReadmodelPurpose)
              .values(riskAnalysisAnswerSQL);
          }
        }

        for (const versionSQL of versionsSQL) {
          await tx.insert(purposeVersionInReadmodelPurpose).values(versionSQL);
        }

        for (const versionDocumentSQL of versionDocumentsSQL) {
          await tx
            .insert(purposeVersionDocumentInReadmodelPurpose)
            .values(versionDocumentSQL);
        }

        for (const versionStampSQL of versionStampsSQL) {
          await tx
            .insert(purposeVersionStampInReadmodelPurpose)
            .values(versionStampSQL);
        }

        for (const versionSignedDocumentSQL of versionSignedDocumentsSQL) {
          await tx
            .insert(purposeVersionSignedDocumentInReadmodelPurpose)
            .values(versionSignedDocumentSQL);
        }
      });
    },
    async deletePurposeById(
      purposeId: PurposeId,
      version: number
    ): Promise<void> {
      await db
        .delete(purposeInReadmodelPurpose)
        .where(
          and(
            eq(purposeInReadmodelPurpose.id, purposeId),
            lte(purposeInReadmodelPurpose.metadataVersion, version)
          )
        );
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

        const { versionSQL, versionDocumentSQL, versionStampsSQL } =
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
        for (const versionStampSQL of versionStampsSQL) {
          await tx
            .insert(purposeVersionStampInReadmodelPurpose)
            .values(versionStampSQL);
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
export type PurposeWriterService = ReturnType<
  typeof purposeWriterServiceBuilder
>;
