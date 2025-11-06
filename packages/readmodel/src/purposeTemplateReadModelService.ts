import { eq, SQL } from "drizzle-orm";
import {
  EServiceDescriptorPurposeTemplate,
  genericInternalError,
  PurposeTemplate,
  PurposeTemplateId,
  stringToDate,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
} from "pagopa-interop-readmodel-models";
import {
  aggregatePurposeTemplate,
  aggregatePurposeTemplateArray,
  toPurposeTemplateAggregator,
  toPurposeTemplateAggregatorArray,
} from "./purpose-template/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    async getPurposeTemplateById(
      purposeTemplateId: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await this.getPurposeTemplateByFilter(
        eq(purposeTemplateInReadmodelPurposeTemplate.id, purposeTemplateId)
      );
    },
    async getPurposeTemplateByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      /*
        purpose template -> 1 purpose_risk_analysis_form_template -> 2 purpose_risk_analysis_template_answer -> 3 purpose_risk_analysis_template_answer_annotation -> 4 purpose_risk_analysis_template_answer_annotation_document -> 5 purpose_risk_analysis_template_document
      */
      const queryResult = await db
        .select({
          purposeTemplate: purposeTemplateInReadmodelPurposeTemplate,
          purposeRiskAnalysisFormTemplate:
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswer:
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotation:
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotationDocument:
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateDocument:
            purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
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
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        )
        .leftJoin(
          // 3
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId
          )
        )
        .leftJoin(
          // 4
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
          )
        )
        .leftJoin(
          // 5
          purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregatePurposeTemplate(toPurposeTemplateAggregator(queryResult));
    },
    async getPurposeTemplatesByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<PurposeTemplate>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select({
          purposeTemplate: purposeTemplateInReadmodelPurposeTemplate,
          purposeRiskAnalysisFormTemplate:
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswer:
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotation:
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotationDocument:
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateDocument:
            purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
        })
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .where(filter)
        .leftJoin(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormDocumentInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        );

      return aggregatePurposeTemplateArray(
        toPurposeTemplateAggregatorArray(queryResult)
      );
    },
    async getPurposeTemplateEServiceDescriptorsByPurposeTemplateId(
      purposeTemplateId: PurposeTemplateId
    ): Promise<Array<WithMetadata<EServiceDescriptorPurposeTemplate>>> {
      return await this.getPurposeTemplateEServiceDescriptorsByFilter(
        eq(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
          purposeTemplateId
        )
      );
    },
    async getPurposeTemplateEServiceDescriptorsByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<EServiceDescriptorPurposeTemplate>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await db
        .select()
        .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
        .where(filter);

      return queryResult.map((row) => ({
        data: {
          purposeTemplateId: unsafeBrandId(row.purposeTemplateId),
          eserviceId: unsafeBrandId(row.eserviceId),
          descriptorId: unsafeBrandId(row.descriptorId),
          createdAt: stringToDate(row.createdAt),
        },
        metadata: { version: row.metadataVersion },
      }));
    },
  };
}
export type PurposeTemplateReadModelService = ReturnType<
  typeof purposeTemplateReadModelServiceBuilder
>;
