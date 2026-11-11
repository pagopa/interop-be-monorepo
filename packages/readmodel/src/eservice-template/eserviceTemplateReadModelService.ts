import { eq, SQL } from "drizzle-orm";
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
  eserviceTemplateVersionAsyncExchangePropertiesInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
} from "pagopa-interop-readmodel-models";

import {
  aggregateEServiceTemplate,
  aggregateEServiceTemplateArray,
  toEServiceTemplateAggregator,
  toEServiceTemplateAggregatorArray,
} from "./aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getEServiceTemplatesQueryResult(db: DrizzleReturnType, filter: SQL) {
  /*
    eservice template   ->1 version ->2 interface
                            version ->3 document
                            version ->4 attribute
                            version ->7 async exchange properties
                        ->5 risk analysis ->6 answer
  */
  return db
    .select({
      eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
      version: eserviceTemplateVersionInReadmodelEserviceTemplate,
      interface: eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
      document: eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
      attribute: eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
      riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
      riskAnalysisAnswer:
        eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
      asyncExchangeProperties:
        eserviceTemplateVersionAsyncExchangePropertiesInReadmodelEserviceTemplate,
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
    )
    .leftJoin(
      // 7
      eserviceTemplateVersionAsyncExchangePropertiesInReadmodelEserviceTemplate,
      eq(
        eserviceTemplateVersionInReadmodelEserviceTemplate.id,
        eserviceTemplateVersionAsyncExchangePropertiesInReadmodelEserviceTemplate.versionId
      )
    );
}

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

      const queryResult = await getEServiceTemplatesQueryResult(db, filter);

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateEServiceTemplate(
        toEServiceTemplateAggregator(queryResult)
      );
    },
    async getEServiceTemplatesByFilter(
      filter: SQL | undefined
    ): Promise<EServiceTemplate[]> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await getEServiceTemplatesQueryResult(db, filter);

      return aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(queryResult)
      ).map((eserviceTemplate) => eserviceTemplate.data);
    },
  };
}
export type EServiceTemplateReadModelService = ReturnType<
  typeof eserviceTemplateReadModelServiceBuilder
>;
