import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  getLatestVersionFormRules,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  generateId,
  PurposeTemplate,
  purposeTemplateEventToBinaryDataV2,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswer,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  TenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  purposeTemplateNotFound,
  riskAnalysisAnswerAnnotationNotFound,
  riskAnalysisAnswerNotFound,
  riskAnalysisFormTemplateNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded,
} from "../model/domain/toEvent.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import {
  assertAnnotationDocumentIsUnique,
  assertConsistentFreeOfCharge,
  assertDocumentsLimitsNotReached,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertTemplateStateNotDraft,
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

function retrieveRiskAnalysisFormTemplate(
  purposeTemplate: PurposeTemplate
): RiskAnalysisFormTemplate {
  if (!purposeTemplate.purposeRiskAnalysisForm) {
    throw riskAnalysisFormTemplateNotFound(purposeTemplate.id);
  }
  return purposeTemplate.purposeRiskAnalysisForm;
}

function retrieveRiskAnalysisTemplateAnswer(
  purposeRiskAnalysisForm: RiskAnalysisFormTemplate,
  answerId: string,
  purposeTemplateId: PurposeTemplateId
): RiskAnalysisTemplateAnswer {
  const singleAnswer = purposeRiskAnalysisForm?.singleAnswers.find(
    (a) => a.id === answerId
  );
  if (singleAnswer) {
    return { type: "single", answer: singleAnswer };
  }

  const multiAnswer = purposeRiskAnalysisForm?.multiAnswers.find(
    (a) => a.id === answerId
  );
  if (multiAnswer) {
    return { type: "multi", answer: multiAnswer };
  }

  throw riskAnalysisAnswerNotFound(purposeTemplateId, answerId);
}

function retrieveAnswerAnnotation(
  { answer }: RiskAnalysisTemplateAnswer,
  purposeTemplateId: PurposeTemplateId
): RiskAnalysisTemplateAnswerAnnotation {
  if (!answer?.annotation) {
    throw riskAnalysisAnswerAnnotationNotFound(purposeTemplateId, answer.id);
  }
  return answer.annotation;
}

function getDefaultRiskAnalysisFormTemplate(
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  const versionedRules = getLatestVersionFormRules(tenantKind);
  if (!versionedRules) {
    throw ruleSetNotFoundError(tenantKind);
  }

  return {
    id: generateId(),
    version: versionedRules.version,
    singleAnswers: [],
    multiAnswers: [],
  };
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

      const validatedPurposeRiskAnalysisFormSeed = seed.purposeRiskAnalysisForm
        ? validateAndTransformRiskAnalysisTemplate(
            seed.purposeRiskAnalysisForm,
            seed.targetTenantKind
          )
        : getDefaultRiskAnalysisFormTemplate(seed.targetTenantKind);

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
    async getPurposeTemplateById(
      id: PurposeTemplateId,
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Retrieving purpose template ${id}`);
      return retrievePurposeTemplate(id, readModelService);
    },
    async addRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      answerId: string,
      body: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocumentSeed,
      {
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument>> {
      logger.info(
        `Adding annotation document to risk analysis template answer ${purposeTemplateId}`
      );

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );
      assertTemplateStateNotDraft(purposeTemplate.data);

      const riskAnalysisFormTemplate = retrieveRiskAnalysisFormTemplate(
        purposeTemplate.data
      );

      const answerToUpdate: RiskAnalysisTemplateAnswer =
        retrieveRiskAnalysisTemplateAnswer(
          riskAnalysisFormTemplate,
          answerId,
          purposeTemplateId
        );

      assertAnnotationDocumentIsUnique(
        answerToUpdate,
        body.checksum,
        body.prettyName
      );

      const oldAnnotation = retrieveAnswerAnnotation(
        answerToUpdate,
        purposeTemplate.data.id
      );

      assertDocumentsLimitsNotReached(oldAnnotation.docs, answerId);

      const newAnnotationDocument: RiskAnalysisTemplateAnswerAnnotationDocument =
        {
          id: generateId(),
          name: body.name,
          prettyName: body.prettyName,
          contentType: body.contentType,
          path: body.path,
          createdAt: new Date(),
          checksum: body.checksum,
        };

      const updatedAnnotation: RiskAnalysisTemplateAnswerAnnotation = {
        ...oldAnnotation,
        docs: [
          ...(oldAnnotation.docs ? oldAnnotation.docs : []),
          newAnnotationDocument,
        ],
      };

      const updatedAnswers =
        answerToUpdate.type === "single"
          ? {
              multiAnswers: riskAnalysisFormTemplate.multiAnswers,
              singleAnswers: riskAnalysisFormTemplate.singleAnswers.map((a) =>
                a.id === answerId ? { ...a, annotation: updatedAnnotation } : a
              ),
            }
          : {
              singleAnswers: riskAnalysisFormTemplate.singleAnswers,
              multiAnswers: riskAnalysisFormTemplate.multiAnswers.map((a) =>
                a.id === answerId ? { ...a, annotation: updatedAnnotation } : a
              ),
            };

      const updatedRiskAnalysisFormTemplate: RiskAnalysisFormTemplate = {
        ...riskAnalysisFormTemplate,
        singleAnswers: updatedAnswers.singleAnswers,
        multiAnswers: updatedAnswers.multiAnswers,
      };

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        purposeRiskAnalysisForm: updatedRiskAnalysisFormTemplate,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded(
          updatedPurposeTemplate,
          newAnnotationDocument.id,
          purposeTemplate.metadata.version,
          correlationId
        )
      );

      return {
        data: newAnnotationDocument,
        metadata: {
          version: event.newVersion,
        },
      };
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
