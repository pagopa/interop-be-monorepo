import { and, eq, SQL } from "drizzle-orm";
import {
  genericInternalError,
  Purpose,
  PurposeId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";
import {
  aggregatePurpose,
  aggregatePurposeArray,
  toPurposeAggregator,
  toPurposeAggregatorArray,
} from "./purpose/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getPurposeById(
      purposeId: PurposeId
    ): Promise<WithMetadata<Purpose> | undefined> {
      return await this.getPurposeByFilter(
        eq(purposeInReadmodelPurpose.id, purposeId)
      );
    },
    async getPurposeByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<Purpose> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      /*
        purpose -> 1 purpose_risk_analysis_form -> 2 purpose_risk_analysis_answer
                -> 3 purpose_version -> 4 purpose_version_document
                                     -> 5 purpose_version_stamp
      */
      const queryResult = await db
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeVersionStamp: purposeVersionStampInReadmodelPurpose,
        })
        .from(purposeInReadmodelPurpose)
        .where(filter)
        .leftJoin(
          // 1
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 2
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
          // 3
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 4
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          // 5
          purposeVersionStampInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionStampInReadmodelPurpose.purposeVersionId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregatePurpose(toPurposeAggregator(queryResult));
    },
    async getPurposesByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<Purpose>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeVersionStamp: purposeVersionStampInReadmodelPurpose,
        })
        .from(purposeInReadmodelPurpose)
        .where(filter)
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
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult));
    },
  };
}
export type PurposeReadModelService = ReturnType<
  typeof purposeReadModelServiceBuilder
>;
