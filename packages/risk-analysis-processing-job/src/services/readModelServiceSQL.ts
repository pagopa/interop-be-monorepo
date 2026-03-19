import { and, eq, isNull, or } from "drizzle-orm";
import { EService, Purpose } from "pagopa-interop-models";
import {
  aggregateEserviceArray,
  toEServiceAggregatorArray,
  toPurposeAggregatorArray,
  aggregatePurposeArray,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
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
          riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          and(
            eq(
              eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
              eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
            ),
            eq(
              eserviceRiskAnalysisInReadmodelCatalog.eserviceId,
              eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId
            )
          )
        )
        .where(
          or(
            isNull(eserviceRiskAnalysisInReadmodelCatalog.tenantKind),
            eq(eserviceRiskAnalysisInReadmodelCatalog.tenantKind, '')
          )
        );

      return aggregateEserviceArray(
        toEServiceAggregatorArray(queryResult as Parameters<typeof toEServiceAggregatorArray>[0])
      ).map(
        (e) => e.data
      );
    },

    async getAllReadModelPurposes(): Promise<Purpose[]> {
      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeVersionStamp: purposeVersionStampInReadmodelPurpose,
          purposeVersionSignedDocument:
            purposeVersionSignedDocumentInReadmodelPurpose,
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
        .leftJoin(
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          purposeVersionStampInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionStampInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          purposeVersionSignedDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionSignedDocumentInReadmodelPurpose.purposeVersionId
          )
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult)).map(
        (p) => p.data
      );
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
