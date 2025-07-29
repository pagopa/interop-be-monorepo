import { and, eq, lte } from "drizzle-orm";
import { EServiceTemplate, EServiceTemplateId } from "pagopa-interop-models";
import {
  checkMetadataVersion,
  splitEServiceTemplateIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateWriterServiceBuilder(
  readModelDB: DrizzleReturnType
) {
  return {
    async upsertEServiceTemplate(
      eserviceTemplate: EServiceTemplate,
      metadataVersion: number
    ): Promise<void> {
      await readModelDB.transaction(async (tx) => {
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

        const {
          eserviceTemplateSQL,
          riskAnalysesSQL,
          riskAnalysisAnswersSQL,
          versionsSQL,
          attributesSQL,
          interfacesSQL,
          documentsSQL,
        } = splitEServiceTemplateIntoObjectsSQL(
          eserviceTemplate,
          metadataVersion
        );

        await tx
          .insert(eserviceTemplateInReadmodelEserviceTemplate)
          .values(eserviceTemplateSQL);

        for (const versionSQL of versionsSQL) {
          await tx
            .insert(eserviceTemplateVersionInReadmodelEserviceTemplate)
            .values(versionSQL);
        }

        for (const interfaceSQL of interfacesSQL) {
          await tx
            .insert(eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate)
            .values(interfaceSQL);
        }

        for (const docSQL of documentsSQL) {
          await tx
            .insert(eserviceTemplateVersionDocumentInReadmodelEserviceTemplate)
            .values(docSQL);
        }

        for (const attributeSQL of attributesSQL) {
          await tx
            .insert(eserviceTemplateVersionAttributeInReadmodelEserviceTemplate)
            .values(attributeSQL);
        }

        for (const riskAnalysisSQL of riskAnalysesSQL) {
          await tx
            .insert(eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate)
            .values(riskAnalysisSQL);
        }

        for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
          await tx
            .insert(
              eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate
            )
            .values(riskAnalysisAnswerSQL);
        }
      });
    },
    async deleteEServiceTemplateById(
      eserviceTemplateId: EServiceTemplateId,
      metadataVersion: number
    ): Promise<void> {
      await readModelDB
        .delete(eserviceTemplateInReadmodelEserviceTemplate)
        .where(
          and(
            eq(
              eserviceTemplateInReadmodelEserviceTemplate.id,
              eserviceTemplateId
            ),
            lte(
              eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}
export type EServiceTemplateWriterService = ReturnType<
  typeof eserviceTemplateWriterServiceBuilder
>;
