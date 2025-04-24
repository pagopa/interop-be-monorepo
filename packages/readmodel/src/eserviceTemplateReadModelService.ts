import {
  EServiceTemplate,
  EServiceTemplateId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
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
import { and, eq, lte, SQL } from "drizzle-orm";
import { splitEServiceTemplateIntoObjectsSQL } from "./eservice-template/splitters.js";
import {
  aggregateEServiceTemplate,
  aggregateEServiceTemplateArray,
  toEServiceTemplateAggregator,
  toEServiceTemplateAggregatorArray,
} from "./eservice-template/aggregators.js";
import { checkMetadataVersion } from "./utils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async upsertEServiceTemplate(
      eserviceTemplate: EServiceTemplate,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
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
    async getEServiceTemplateById(
      eserviceTemplateId: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return this.getEServiceTemplateByFilter(
        eq(eserviceTemplateInReadmodelEserviceTemplate.id, eserviceTemplateId)
      );
    },
    async getEServiceTemplateByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      /*
        eservice template   ->1 version ->2 interface
                                version ->3 document
                                version ->4 attribute
                            ->5 risk analysis ->6 answer
      */
      const queryResult = await db
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          version: eserviceTemplateVersionInReadmodelEserviceTemplate,
          interface:
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          document: eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          attribute:
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          riskAnalysisAnswer:
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .where(filter)
        .leftJoin(
          // 1
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          // 2
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 3
          eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 4
          eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 5
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          // 6
          eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.riskAnalysisFormId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateEServiceTemplate(
        toEServiceTemplateAggregator(queryResult)
      );
    },
    async getEServiceTemplatesByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<EServiceTemplate>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          version: eserviceTemplateVersionInReadmodelEserviceTemplate,
          interface:
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          document: eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          attribute:
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          riskAnalysisAnswer:
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .where(filter)
        .leftJoin(
          // 1
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          // 2
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 3
          eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 4
          eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 5
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          // 6
          eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.riskAnalysisFormId
          )
        );

      return aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(queryResult)
      );
    },
    async deleteEServiceTemplateById(
      eserviceTemplateId: EServiceTemplateId,
      metadataVersion: number
    ): Promise<void> {
      await db
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

export type EServiceTemplateReadModelService = ReturnType<
  typeof eserviceTemplateReadModelServiceBuilder
>;
