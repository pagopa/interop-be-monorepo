import { and, eq, SQL } from "drizzle-orm";
import {
  genericInternalError,
  PurposeTemplate,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
} from "pagopa-interop-readmodel-models";
import {
  aggregatePurposeTemplate,
  toPurposeTemplateAggregator,
} from "./purpose-template/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getPurposeTemplateByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          purposeTemplate: purposeTemplateInReadmodelPurposeTemplate,
          purposeTemplateRiskAnalysisForm:
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          purposeTemplateRiskAnalysisAnswer:
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          purposeTemplateRiskAnalysisAnswerAnnotation:
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          purposeTemplateRiskAnalysisAnswerAnnotationDocument:
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
        })
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .where(filter)
        .leftJoin(
          // 1
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          // 2
          purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          and(
            eq(
              purposeTemplateInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.purposeTemplateId
            ),
            eq(
              purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
            )
          )
        )
        .leftJoin(
          // 3
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          // 4
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.purposeTemplateId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregatePurposeTemplate(toPurposeTemplateAggregator(queryResult));
    },
  };
}

export type PurposeTemplateReadModelService = ReturnType<
  typeof purposeTemplateReadModelServiceBuilder
>;
