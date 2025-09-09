import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
  RiskAnalysisTemplateAnswerAnnotationId,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisFormTemplateId,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  purposeTemplateNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
} from "../model/domain/errors.js";
import { toCreateEventPurposeTemplateAdded } from "../model/domain/toEvent.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertPurposeTemplateTitleIsNotDuplicated,
  validateAndTransformRiskAnalysisTemplate,
} from "./validators.js";

async function retrievePurposeTemplate(
  id: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<PurposeTemplate>> {
  const purposeTemplate = await readModelService.getPurposeTemplateById(id);
  if (!purposeTemplate) {
    throw purposeTemplateNotFound(id);
  }
  return purposeTemplate;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  const repository = eventRepository(
    dbInstance,
    purposeTemplateEventToBinaryDataV2
  );

  return {
    async createPurposeTemplate(
      seed: purposeTemplateApi.PurposeTemplateSeed,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Creating purpose template`);

      assertConsistentFreeOfCharge(
        seed.purposeIsFreeOfCharge,
        seed.purposeFreeOfChargeReason
      );

      await assertPurposeTemplateTitleIsNotDuplicated({
        readModelService,
        title: seed.purposeTitle,
      });

      const validatedPurposeRiskAnalysisFormSeed =
        validateAndTransformRiskAnalysisTemplate(
          seed.purposeRiskAnalysisForm,
          seed.targetTenantKind
        );

      const purposeTemplate: PurposeTemplate = {
        id: generateId(),
        targetDescription: seed.targetDescription,
        targetTenantKind: seed.targetTenantKind,
        creatorId: authData.organizationId,
        state: purposeTemplateState.draft,
        createdAt: new Date(),
        purposeTitle: seed.purposeTitle,
        purposeDescription: seed.purposeDescription,
        purposeRiskAnalysisForm: validatedPurposeRiskAnalysisFormSeed,
        purposeIsFreeOfCharge: seed.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason: seed.purposeFreeOfChargeReason,
        purposeDailyCalls: seed.purposeDailyCalls,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateAdded(purposeTemplate, correlationId)
      );

      return {
        data: purposeTemplate,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async getPurposeTemplates(
      filters: GetPurposeTemplatesFilters,
      {
        offset,
        limit,
        sortColumns,
        directions,
      }: {
        offset: number;
        limit: number;
        sortColumns: string | undefined;
        directions: string | undefined;
      },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<PurposeTemplate>> {
      logger.info(
        `Getting purpose templates with filters: ${JSON.stringify(
          filters
        )}, limit = ${limit}, offset = ${offset}, sortColumns = ${sortColumns}, directions = ${directions}`
      );

      // Permissions are checked in the readModelService
      return await readModelService.getPurposeTemplates(filters, {
        offset,
        limit,
        sortColumns,
        directions,
      });
    },
    async getPurposeTemplateById(
      id: PurposeTemplateId,
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Retrieving purpose template ${id}`);
      return retrievePurposeTemplate(id, readModelService);
    },
    async getRiskAnalysisTemplateAnswerAnnotationDocument(
      {
        purposeTemplateId,
        riskAnalysisTemplateId,
        answerId,
        annotationId,
        documentId,
      }: {
        purposeTemplateId: PurposeTemplateId;
        riskAnalysisTemplateId: RiskAnalysisFormTemplateId;
        answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
        annotationId: RiskAnalysisTemplateAnswerAnnotationId;
        documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId;
      },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument>> {
      logger.info(
        `Retrieving risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId}, risk analysis form template ${riskAnalysisTemplateId}, answer ${answerId} and annotation ${annotationId}`
      );

      // TODO: worth it doing all these checks to throw the specific errors?
      // await retrievePurposeTemplate(purposeTemplateId, readModelService);
      // await retrieveRiskAnalysisTemplate(
      //   riskAnalysisTemplateId,
      //   readModelService
      // );
      // await retrieveRiskAnalysisTemplateAnswer(
      //   riskAnalysisTemplateId,
      //   answerId,
      //   readModelService
      // );
      // await retrieveRiskAnalysisTemplateAnswerAnnotation(
      //   riskAnalysisTemplateId,
      //   answerId,
      //   annotationId,
      //   readModelService
      // );

      const annotationDocument =
        await readModelService.getRiskAnalysisTemplateAnswerAnnotationDocument(
          purposeTemplateId,
          annotationId
        );

      if (!annotationDocument) {
        throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound({
          purposeTemplateId,
          riskAnalysisTemplateId,
          answerId,
          annotationId,
          documentId,
        });
      }

      return annotationDocument;
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
