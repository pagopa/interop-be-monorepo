import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
} from "pagopa-interop-models";
import {
  AppContext,
  DB,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { purposeTemplateNotFound } from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertPurposeTemplateTitleIsNotDuplicated,
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
  _dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  // TODO : use it to write purpose template events in the event store
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const repository = eventRepository(dbInstance, purposeEventToBinaryDataV2);

  return {
    async createPurposeTemplate(
      seed: purposeTemplateApi.PurposeTemplateSeed,
      {
        authData,
        correlationId,
        logger,
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

      // todo validateAndTransformRiskAnalysis?

      const purposeTemplate: PurposeTemplate = {
        id: generateId(),
        targetDescription: seed.targetDescription,
        targetTenantKind: seed.targetTenantKind,
        creatorId: authData.organizationId,
        state: purposeTemplateState.draft,
        createdAt: new Date(),
        purposeTitle: seed.purposeTitle,
        purposeDescription: seed.purposeDescription,
        purposeRiskAnalysisForm: seed.purposeRiskAnalysisForm
          ? {
              id: generateId(),
              version: seed.purposeRiskAnalysisForm.version,
              singleAnswers: seed.purposeRiskAnalysisForm.answers.map(
                (answer: purposeTemplateApi.RiskAnalysisTemplateAnswer) => ({
                  value: answer.value,
                  editable: answer.editable,
                  annotation: answer.annotation,
                  suggestedValues: answer.suggestedValues,
                })
              ),
              multiAnswers: seed.purposeRiskAnalysisForm.answers.map(
                (answer: purposeTemplateApi.RiskAnalysisTemplateAnswer) => ({
                  id: generateId(),
                  value: answer.value,
                  editable: answer.editable,
                  annotation: answer.annotation,
                })
              ),
            }
          : undefined,
        purposeIsFreeOfCharge: seed.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason: seed.purposeFreeOfChargeReason,
        purposeDailyCalls: seed.purposeDailyCalls,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateAdded(purposeTemplate, correlationId)
      );
      return {
        data: {
          purposeTemplate,
          isRiskAnalysisValid: validatedFormSeed !== undefined,
        },
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
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
