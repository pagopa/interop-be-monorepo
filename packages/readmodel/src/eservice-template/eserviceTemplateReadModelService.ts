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
import { eq, SQL } from "drizzle-orm";
import {
  aggregateEServiceTemplate,
  toEServiceTemplateAggregator,
} from "./eservice-template/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
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
  };
}
export type EServiceTemplateReadModelService = ReturnType<
  typeof eserviceTemplateReadModelServiceBuilder
>;
