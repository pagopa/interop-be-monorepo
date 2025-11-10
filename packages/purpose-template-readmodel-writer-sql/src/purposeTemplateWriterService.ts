import {
  DescriptorId,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  PurposeTemplate,
  PurposeTemplateId,
} from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitPurposeTemplateIntoObjectsSQL,
  toPurposeTemplateEServiceDescriptorSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  DrizzleTransactionType,
  purposeTemplateChildTables,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
  purposeTemplateTables,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateWriterServiceBuilder(db: DrizzleReturnType) {
  const updateMetadataVersionInPurposeTemplateTables = async (
    tx: DrizzleTransactionType,
    purposeTemplateId: PurposeTemplateId,
    newMetadataVersion: number,
    tables: typeof purposeTemplateTables = purposeTemplateTables
  ): Promise<void> => {
    for (const table of tables) {
      await tx
        .update(table)
        .set({ metadataVersion: newMetadataVersion })
        .where(
          and(
            eq(
              "purposeTemplateId" in table ? table.purposeTemplateId : table.id,
              purposeTemplateId
            ),
            lte(table.metadataVersion, newMetadataVersion)
          )
        );
    }
  };

  return {
    async upsertPurposeTemplate(
      purposeTemplate: PurposeTemplate,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          purposeTemplateInReadmodelPurposeTemplate,
          metadataVersion,
          purposeTemplate.id
        );

        if (!shouldUpsert) {
          return;
        }

        for (const table of purposeTemplateChildTables) {
          if (
            table !==
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
          ) {
            await tx
              .delete(table)
              .where(eq(table.purposeTemplateId, purposeTemplate.id));
          }
        }

        const {
          purposeTemplateSQL,
          riskAnalysisFormTemplateSQL,
          riskAnalysisTemplateAnswersSQL,
          riskAnalysisTemplateAnswersAnnotationsSQL,
          riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
        } = splitPurposeTemplateIntoObjectsSQL(
          purposeTemplate,
          metadataVersion
        );

        await tx
          .insert(purposeTemplateInReadmodelPurposeTemplate)
          .values(purposeTemplateSQL)
          .onConflictDoUpdate({
            target: purposeTemplateInReadmodelPurposeTemplate.id,
            set: purposeTemplateSQL,
          });

        if (riskAnalysisFormTemplateSQL) {
          await tx
            .insert(purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate)
            .values(riskAnalysisFormTemplateSQL);
        }

        if (riskAnalysisTemplateAnswersSQL) {
          for (const answerSQL of riskAnalysisTemplateAnswersSQL) {
            await tx
              .insert(
                purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate
              )
              .values(answerSQL);
          }
        }

        for (const annotationSQL of riskAnalysisTemplateAnswersAnnotationsSQL) {
          await tx
            .insert(
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate
            )
            .values(annotationSQL);
        }

        for (const annotationDocumentSQL of riskAnalysisTemplateAnswersAnnotationsDocumentsSQL) {
          await tx
            .insert(
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
            )
            .values(annotationDocumentSQL);
        }

        await updateMetadataVersionInPurposeTemplateTables(
          tx,
          purposeTemplate.id,
          metadataVersion,
          [purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate]
        );
      });
    },
    async upsertPurposeTemplateEServiceDescriptor(
      purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          purposeTemplateInReadmodelPurposeTemplate,
          metadataVersion,
          purposeTemplateEServiceDescriptor.purposeTemplateId
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
          .where(
            and(
              eq(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
                purposeTemplateEServiceDescriptor.purposeTemplateId
              ),
              eq(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
                purposeTemplateEServiceDescriptor.eserviceId
              ),
              eq(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.descriptorId,
                purposeTemplateEServiceDescriptor.descriptorId
              )
            )
          );

        await tx
          .insert(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
          .values(
            toPurposeTemplateEServiceDescriptorSQL(
              purposeTemplateEServiceDescriptor,
              metadataVersion
            )
          );

        await updateMetadataVersionInPurposeTemplateTables(
          tx,
          purposeTemplateEServiceDescriptor.purposeTemplateId,
          metadataVersion
        );
      });
    },
    async deletePurposeTemplateById(
      purposeTemplateId: PurposeTemplateId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(purposeTemplateInReadmodelPurposeTemplate)
        .where(
          and(
            eq(purposeTemplateInReadmodelPurposeTemplate.id, purposeTemplateId),
            lte(
              purposeTemplateInReadmodelPurposeTemplate.metadataVersion,
              metadataVersion
            )
          )
        );
    },
    async deletePurposeTemplateEServiceDescriptorsByEServiceIdAndDescriptorId({
      purposeTemplateId,
      eserviceId,
      descriptorId,
      metadataVersion,
    }: {
      purposeTemplateId: PurposeTemplateId;
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      metadataVersion: number;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        await tx
          .delete(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
          .where(
            and(
              eq(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
                eserviceId
              ),
              eq(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.descriptorId,
                descriptorId
              ),
              eq(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
                purposeTemplateId
              ),
              lte(
                purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.metadataVersion,
                metadataVersion
              )
            )
          );

        await updateMetadataVersionInPurposeTemplateTables(
          tx,
          purposeTemplateId,
          metadataVersion
        );
      });
    },
  };
}
export type PurposeTemplateWriterService = ReturnType<
  typeof purposeTemplateWriterServiceBuilder
>;
