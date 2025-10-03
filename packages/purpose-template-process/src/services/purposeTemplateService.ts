import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  RiskAnalysisFormTemplate,
  TenantKind,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  getLatestVersionFormRules,
  M2MAdminAuthData,
  M2MAuthData,
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  associationEServicesForPurposeTemplateFailed,
  purposeTemplateNotFound,
  disassociationEServicesFromPurposeTemplateFailed,
  purposeTemplateRiskAnalysisFormNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateEServiceLinked,
  toCreateEventPurposeTemplateEServiceUnlinked,
  toCreateEventPurposeTemplatePublished,
} from "../model/domain/toEvent.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertActivatableState,
  assertConsistentFreeOfCharge,
  assertEServiceIdsCountIsBelowThreshold,
  assertPurposeTemplateStateIsValid,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterCanRetrievePurposeTemplate,
  assertRequesterIsCreator,
  validateAndTransformRiskAnalysisTemplate,
  validateEservicesAssociations,
  validateEservicesDisassociations,
  validateRiskAnalysisTemplateOrThrow,
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
    async getPurposeTemplates(
      filters: GetPurposeTemplatesFilters,
      { offset, limit }: { offset: number; limit: number },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<PurposeTemplate>> {
      logger.info(
        `Getting purpose templates with filters: ${JSON.stringify(
          filters
        )}, limit = ${limit}, offset = ${offset}`
      );

      return await readModelService.getPurposeTemplates(filters, {
        offset,
        limit,
      });
    },
    async getPurposeTemplateById(
      purposeTemplateId: PurposeTemplateId,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Retrieving purpose template ${purposeTemplateId}`);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      await assertRequesterCanRetrievePurposeTemplate(
        purposeTemplate.data,
        authData
      );

      return purposeTemplate;
    },
    async linkEservicesToPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      eserviceIds: EServiceId[],
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<EServiceDescriptorPurposeTemplate[]> {
      logger.info(
        `Linking e-services ${eserviceIds} to purpose template ${purposeTemplateId}`
      );

      assertEServiceIdsCountIsBelowThreshold(eserviceIds.length);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertPurposeTemplateStateIsValid(purposeTemplate.data, [
        purposeTemplateState.draft,
        purposeTemplateState.active,
      ]);

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

      const validationResult = await validateEservicesAssociations(
        eserviceIds,
        purposeTemplateId,
        readModelService
      );

      if (validationResult.type === "invalid") {
        throw associationEServicesForPurposeTemplateFailed(
          validationResult.issues,
          eserviceIds,
          purposeTemplateId
        );
      }

      const creationTimestamp = new Date();

      const createEvents = validationResult.value.map(
        (purposeTemplateValidationResult, index: number) => {
          const eServiceDescriptorPurposeTemplate: EServiceDescriptorPurposeTemplate =
            {
              purposeTemplateId,
              eserviceId: purposeTemplateValidationResult.eservice.id,
              descriptorId: purposeTemplateValidationResult.descriptorId,
              createdAt: creationTimestamp,
            };

          const version = purposeTemplate.metadata.version + index;

          return toCreateEventPurposeTemplateEServiceLinked(
            eServiceDescriptorPurposeTemplate,
            purposeTemplate.data,
            purposeTemplateValidationResult.eservice,
            correlationId,
            version
          );
        }
      );

      await repository.createEvents(createEvents);

      return validationResult.value.map((purposeTemplateValidationResult) => ({
        purposeTemplateId,
        eserviceId: purposeTemplateValidationResult.eservice.id,
        descriptorId: purposeTemplateValidationResult.descriptorId,
        createdAt: creationTimestamp,
      }));
    },
    async unlinkEservicesFromPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      eserviceIds: EServiceId[],
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<void> {
      logger.info(
        `Unlinking e-services ${eserviceIds} from purpose template ${purposeTemplateId}`
      );

      assertEServiceIdsCountIsBelowThreshold(eserviceIds.length);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertPurposeTemplateStateIsValid(purposeTemplate.data, [
        purposeTemplateState.draft,
        purposeTemplateState.active,
      ]);

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

      const validationResult = await validateEservicesDisassociations(
        eserviceIds,
        purposeTemplateId,
        readModelService
      );

      if (validationResult.type === "invalid") {
        throw disassociationEServicesFromPurposeTemplateFailed(
          validationResult.issues,
          eserviceIds,
          purposeTemplateId
        );
      }

      const creationTimestamp = new Date();

      const createEvents = validationResult.value.map(
        (purposeTemplateValidationResult, index: number) => {
          const eServiceDescriptorPurposeTemplate: EServiceDescriptorPurposeTemplate =
            {
              purposeTemplateId,
              eserviceId: purposeTemplateValidationResult.eservice.id,
              descriptorId: purposeTemplateValidationResult.descriptorId,
              createdAt: creationTimestamp,
            };

          const version = purposeTemplate.metadata.version + index;

          return toCreateEventPurposeTemplateEServiceUnlinked(
            eServiceDescriptorPurposeTemplate,
            purposeTemplate.data,
            purposeTemplateValidationResult.eservice,
            correlationId,
            version
          );
        }
      );

      await repository.createEvents(createEvents);
    },
    async publishPurposeTemplate(
      id: PurposeTemplateId,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Publishing purpose template ${id}`);

      const purposeTemplate = await retrievePurposeTemplate(
        id,
        readModelService
      );

      const purposeRiskAnalysisForm =
        purposeTemplate.data.purposeRiskAnalysisForm;

      if (!purposeRiskAnalysisForm) {
        throw purposeTemplateRiskAnalysisFormNotFound(id);
      }

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertActivatableState(purposeTemplate.data, purposeTemplateState.draft);

      validateRiskAnalysisTemplateOrThrow({
        riskAnalysisFormTemplate:
          riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
            purposeRiskAnalysisForm
          ),
        tenantKind: purposeTemplate.data.targetTenantKind,
      });

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        state: purposeTemplateState.active,
        updatedAt: new Date(),
      };

      const createdEvent = await repository.createEvent(
        toCreateEventPurposeTemplatePublished({
          purposeTemplate: updatedPurposeTemplate,
          version: purposeTemplate.metadata.version,
          correlationId,
        })
      );

      return {
        data: updatedPurposeTemplate,
        metadata: { version: createdEvent.newVersion },
      };
    },
  };
}
export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
