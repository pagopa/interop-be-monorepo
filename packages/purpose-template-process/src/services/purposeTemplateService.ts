import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateMultiAnswer,
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
  purposeTemplateRiskAnalysisFormNotFound,
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
  validateAndTransformRiskAnalysisAnswer,
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

      if (!purposeTemplate.data.purposeRiskAnalysisForm) {
        throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId);
      }

      assertPurposeTemplateStateIsValid(purposeTemplate.data.state, [
        purposeTemplateState.draft,
      ]);

      const validatedAnswer = validateAndTransformRiskAnalysisAnswer(
        riskAnalysisTemplateAnswerRequest,
        purposeTemplate.data.targetTenantKind
      );

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        updatedAt: new Date(),
        purposeRiskAnalysisForm: {
          ...purposeTemplate.data.purposeRiskAnalysisForm,
          singleAnswers:
            "value" in validatedAnswer
              ? [
                  ...purposeTemplate.data.purposeRiskAnalysisForm.singleAnswers,
                  validatedAnswer,
                ]
              : purposeTemplate.data.purposeRiskAnalysisForm.singleAnswers,
          multiAnswers:
            "values" in validatedAnswer
              ? [
                  ...purposeTemplate.data.purposeRiskAnalysisForm.multiAnswers,
                  validatedAnswer,
                ]
              : purposeTemplate.data.purposeRiskAnalysisForm.multiAnswers,
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
        data: validatedAnswer,
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
