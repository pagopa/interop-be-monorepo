import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  RiskAnalysisFormTemplate,
  TenantKind,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisTemplateAnswerAnnotationId,
} from "pagopa-interop-models";
import { riskAnalysisValidatedAnswerToNewRiskAnalysisAnswer } from "pagopa-interop-commons";
import { match } from "ts-pattern";
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
  purposeTemplateNotFound,
  ruleSetNotFoundError,
  riskAnalysisAnswerNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateDraftUpdated,
} from "../model/domain/toEvent.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertPurposeTemplateStateIsValid,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertPurposeTemplateHasRiskAnalysisForm,
  validateRiskAnalysisAnswerOrThrow,
  assertRequesterPurposeTemplateCreator,
  validateAndTransformRiskAnalysisTemplate,
  validateRiskAnalysisAnswerAnnotationOrThrow,
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

function findAnswerAndAnnotation(
  riskAnalysisForm: RiskAnalysisFormTemplate,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
): {
  answer: RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer;
  annotation: RiskAnalysisTemplateAnswerAnnotation | undefined;
} {
  const { singleAnswers, multiAnswers } = riskAnalysisForm;

  const singleAnswer = singleAnswers.find((answer) => answer.id === answerId);
  if (singleAnswer) {
    return {
      answer: singleAnswer,
      annotation: singleAnswer.annotation,
    };
  }

  const multiAnswer = multiAnswers.find((answer) => answer.id === answerId);
  if (multiAnswer) {
    return {
      answer: multiAnswer,
      annotation: multiAnswer.annotation,
    };
  }

  throw riskAnalysisAnswerNotFound(answerId);
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
    async createRiskAnalysisAnswer(
      purposeTemplateId: PurposeTemplateId,
      riskAnalysisTemplateAnswerRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<
        RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
      >
    > {
      logger.info(`Creating risk analysis answer`);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate.data);

      assertPurposeTemplateStateIsValid(purposeTemplate.data.state, [
        purposeTemplateState.draft,
      ]);

      assertRequesterPurposeTemplateCreator(
        purposeTemplate.data.creatorId,
        authData
      );

      const validatedAnswer = validateRiskAnalysisAnswerOrThrow({
        riskAnalysisAnswer: riskAnalysisTemplateAnswerRequest,
        tenantKind: purposeTemplate.data.targetTenantKind,
      });

      const riskAnalysisForm = purposeTemplate.data.purposeRiskAnalysisForm;

      const transformedAnswer =
        riskAnalysisValidatedAnswerToNewRiskAnalysisAnswer(validatedAnswer);

      const updatedPurposeRiskAnalysisForm = match(validatedAnswer)
        .with({ type: "single" }, () => ({
          ...riskAnalysisForm,
          singleAnswers: [
            ...riskAnalysisForm.singleAnswers,
            transformedAnswer as RiskAnalysisTemplateSingleAnswer,
          ],
        }))
        .with({ type: "multi" }, () => ({
          ...riskAnalysisForm,
          multiAnswers: [
            ...riskAnalysisForm.multiAnswers,
            transformedAnswer as RiskAnalysisTemplateMultiAnswer,
          ],
        }))
        .exhaustive();

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        updatedAt: new Date(),
        purposeRiskAnalysisForm: updatedPurposeRiskAnalysisForm,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateDraftUpdated(
          updatedPurposeTemplate,
          correlationId,
          purposeTemplate.metadata.version
        )
      );

      return {
        data: transformedAnswer,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async addRiskAnalysisAnswerAnnotation(
      purposeTemplateId: PurposeTemplateId,
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
      riskAnalysisTemplateAnswerAnnotationRequest: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationText,
      {
        logger,
        correlationId,
        authData,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<RiskAnalysisTemplateAnswerAnnotation>> {
      logger.info(`Add risk analysis answer annotation`);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertRequesterPurposeTemplateCreator(
        purposeTemplate.data.creatorId,
        authData
      );

      assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate.data);

      assertPurposeTemplateStateIsValid(purposeTemplate.data.state, [
        purposeTemplateState.draft,
      ]);

      const riskAnalysisForm = purposeTemplate.data.purposeRiskAnalysisForm;

      const answerAndAnnotation = findAnswerAndAnnotation(
        riskAnalysisForm,
        answerId
      );

      validateRiskAnalysisAnswerAnnotationOrThrow();

      const newAnnotation: RiskAnalysisTemplateAnswerAnnotation =
        answerAndAnnotation.annotation
          ? {
              id: answerAndAnnotation.annotation.id,
              text: riskAnalysisTemplateAnswerAnnotationRequest.text,
              docs: answerAndAnnotation.annotation.docs,
            }
          : {
              id: generateId<RiskAnalysisTemplateAnswerAnnotationId>(),
              text: riskAnalysisTemplateAnswerAnnotationRequest.text,
              docs: [],
            };

      const updateAnswerWithAnnotation = <T extends { id: string }>(
        answer: T
      ): (T & { annotation: RiskAnalysisTemplateAnswerAnnotation }) | T =>
        answer.id === answerId
          ? { ...answer, annotation: newAnnotation }
          : answer;

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        updatedAt: new Date(),
        purposeRiskAnalysisForm: {
          ...riskAnalysisForm,
          singleAnswers: riskAnalysisForm.singleAnswers.map(
            updateAnswerWithAnnotation
          ),
          multiAnswers: riskAnalysisForm.multiAnswers.map(
            updateAnswerWithAnnotation
          ),
        },
      };

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateDraftUpdated(
          updatedPurposeTemplate,
          correlationId,
          purposeTemplate.metadata.version
        )
      );

      return {
        data: newAnnotation,
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
