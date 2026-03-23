import { and, eq, isNull, or } from "drizzle-orm";
import { EService, Purpose, EServiceTemplate } from "pagopa-interop-models";
import {
  aggregateEserviceArray,
  toEServiceAggregatorArray,
  toPurposeAggregatorArray,
  aggregatePurposeArray,
  aggregateEServiceTemplateArray,
  toEServiceTemplateAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getAllReadModelEServicesWithEmptyTenantKindRAs(): Promise<
      EService[]
    > {
      const queryResult = await readModelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .where(
          or(
            isNull(eserviceRiskAnalysisInReadmodelCatalog.tenantKind),
            eq(eserviceRiskAnalysisInReadmodelCatalog.tenantKind, "")
          )
        );

      return aggregateEserviceArray(
        toEServiceAggregatorArray(
          queryResult as Parameters<typeof toEServiceAggregatorArray>[0]
        )
      ).map((e) => e.data);
    },

    async getAllReadModelPurposesWithoutTenantKind(): Promise<Purpose[]> {
      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
        })
        .from(purposeInReadmodelPurpose)
        .leftJoin(
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          and(
            eq(
              purposeInReadmodelPurpose.id,
              purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId
            ),
            eq(
              purposeRiskAnalysisFormInReadmodelPurpose.id,
              purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
            )
          )
        )
        .where(
          or(
            isNull(purposeRiskAnalysisFormInReadmodelPurpose.tenantKind),
            eq(purposeRiskAnalysisFormInReadmodelPurpose.tenantKind, "")
          )
        );

      return aggregatePurposeArray(
        toPurposeAggregatorArray(
          queryResult as Parameters<typeof toPurposeAggregatorArray>[0]
        )
      ).map((p) => p.data);
    },

    async getAllReadModelEServiceTemplates(): Promise<EServiceTemplate[]> {
      const queryResult = await readModelDB
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .leftJoin(
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        );

      return aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(
          queryResult as Parameters<typeof toEServiceTemplateAggregatorArray>[0]
        )
      ).map((p) => p.data);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
