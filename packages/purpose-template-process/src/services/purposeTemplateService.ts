import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
  PurposeTemplateState,
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
  FileManager,
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
  toCreateEventPurposeTemplateDraftUpdated,
  toCreateEventPurposeTemplateEServiceLinked,
  toCreateEventPurposeTemplateEServiceUnlinked,
  toCreateEventPurposeTemplatePublished,
  toCreateEventPurposeTemplateSuspended,
  toCreateEventPurposeTemplateUnsuspended,
} from "../model/domain/toEvent.js";
import { cleanupAnnotationDocsForRemovedAnswers } from "../utilities/riskAnalysisDocUtils.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertActivatableState,
  assertConsistentFreeOfCharge,
  assertEServiceIdsCountIsBelowThreshold,
  assertPurposeTemplateIsDraft,
  assertPurposeTemplateStateIsValid,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterCanRetrievePurposeTemplate,
  assertRequesterIsCreator,
  validateAndTransformRiskAnalysisTemplate,
  validateEservicesAssociations,
  validateEservicesDisassociations,
  validateRiskAnalysisTemplateOrThrow,
  assertSuspendableState,
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
  readModelService: ReadModelServiceSQL,
  fileManager: FileManager
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
    async updatePurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      purposeTemplateSeed: purposeTemplateApi.PurposeTemplateSeed,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Updating purpose template ${purposeTemplateId}`);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertPurposeTemplateIsDraft(purposeTemplate.data);
      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

      if (purposeTemplateSeed.purposeTitle) {
        await assertPurposeTemplateTitleIsNotDuplicated({
          readModelService,
          title: purposeTemplateSeed.purposeTitle,
        });
      }

      assertConsistentFreeOfCharge(
        purposeTemplateSeed.purposeIsFreeOfCharge,
        purposeTemplateSeed.purposeFreeOfChargeReason
      );

      const purposeRiskAnalysisForm =
        purposeTemplateSeed.purposeRiskAnalysisForm
          ? validateAndTransformRiskAnalysisTemplate(
              purposeTemplateSeed.purposeRiskAnalysisForm,
              purposeTemplate.data.targetTenantKind
            )
          : purposeTemplate.data.purposeRiskAnalysisForm;

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        ...purposeTemplateSeed,
        purposeRiskAnalysisForm,
      };

      await cleanupAnnotationDocsForRemovedAnswers(
        purposeTemplateSeed,
        purposeTemplate.data,
        fileManager,
        logger
      );

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateDraftUpdated({
          purposeTemplate: updatedPurposeTemplate,
          correlationId,
          version: purposeTemplate.metadata.version,
        })
      );

      return {
        data: updatedPurposeTemplate,
        metadata: {
          version: event.newVersion,
        },
      };
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

      const updatedPurposeTemplate = await activatePurposeTemplate({
        id,
        expectedInitialState: purposeTemplateState.draft,
        authData,
        readModelService,
      });

      const createdEvent = await repository.createEvent(
        toCreateEventPurposeTemplatePublished({
          purposeTemplate: updatedPurposeTemplate.data,
          version: updatedPurposeTemplate.metadata.version,
          correlationId,
        })
      );

      return {
        data: updatedPurposeTemplate.data,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async unsuspendPurposeTemplate(
      id: PurposeTemplateId,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Unsuspending purpose template ${id}`);

      const updatedPurposeTemplate = await activatePurposeTemplate({
        id,
        expectedInitialState: purposeTemplateState.suspended,
        authData,
        readModelService,
      });

      const createdEvent = await repository.createEvent(
        toCreateEventPurposeTemplateUnsuspended({
          purposeTemplate: updatedPurposeTemplate.data,
          version: updatedPurposeTemplate.metadata.version,
          correlationId,
        })
      );

      return {
        data: updatedPurposeTemplate.data,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async suspendPurposeTemplate(
      id: PurposeTemplateId,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Suspending purpose template ${id}`);

      const purposeTemplate = await retrievePurposeTemplate(
        id,
        readModelService
      );

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertSuspendableState(purposeTemplate.data);

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        state: purposeTemplateState.suspended,
        updatedAt: new Date(),
      };

      const createdEvent = await repository.createEvent(
        toCreateEventPurposeTemplateSuspended({
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

async function activatePurposeTemplate({
  id,
  expectedInitialState,
  authData,
  readModelService,
}: {
  id: PurposeTemplateId;
  expectedInitialState: PurposeTemplateState;
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">;
  readModelService: ReadModelServiceSQL;
}): Promise<WithMetadata<PurposeTemplate>> {
  const purposeTemplate = await retrievePurposeTemplate(id, readModelService);

  const purposeRiskAnalysisForm = purposeTemplate.data.purposeRiskAnalysisForm;

  if (!purposeRiskAnalysisForm) {
    throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplate.data.id);
  }

  assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
  assertActivatableState(purposeTemplate.data, expectedInitialState);

  validateRiskAnalysisTemplateOrThrow({
    riskAnalysisFormTemplate:
      riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate(
        purposeRiskAnalysisForm
      ),
    tenantKind: purposeTemplate.data.targetTenantKind,
  });

  return {
    data: {
      ...purposeTemplate.data,
      state: purposeTemplateState.active,
      updatedAt: new Date(),
    },
    metadata: purposeTemplate.metadata,
  };
}
