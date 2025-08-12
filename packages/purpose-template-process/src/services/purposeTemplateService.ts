import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  EService,
  EServiceId,
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  RiskAnalysisFormTemplate,
  WithMetadata,
} from "pagopa-interop-models";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertPurposeTemplateTitleIsNotDuplicated,
} from "./validators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateServiceBuilder(
  _dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  // TODO : use it to write purpose template events in the event store
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const repository = eventRepository(dbInstance, purposeEventToBinaryDataV2);

  const validateAndTransformRiskAnalysisTemplate = (
    purposeRiskAnalysisForm?: purposeTemplateApi.RiskAnalysisFormTemplateSeed
  ): RiskAnalysisFormTemplate | undefined {

    if(!purposeRiskAnalysisForm) {
      return undefined;
    }

    
    

  }

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

      const validatedPurposeRiskAnalysisForm =
        validateAndTransformRiskAnalysisTemplate(seed.purposeRiskAnalysisForm);

      const purposeTemplate: PurposeTemplate = {
        id: generateId(),
        targetDescription: seed.targetDescription,
        targetTenantKind: seed.targetTenantKind,
        creatorId: authData.organizationId,
        state: purposeTemplateState.draft,
        createdAt: new Date(),
        purposeTitle: seed.purposeTitle,
        purposeDescription: seed.purposeDescription,
        purposeRiskAnalysisForm: validatedPurposeRiskAnalysisForm,
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
      return readModelService.getPurposeTemplateById(id);
    },
  };
}

export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
