import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
  PurposeTemplateState,
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
  missingRiskAnalysisFormTemplate,
  purposeTemplateNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateArchived,
  toCreateEventPurposeTemplatePublished,
  toCreateEventPurposeTemplateSuspended,
  toCreateEventPurposeTemplateUnsuspended,
} from "../model/domain/toEvent.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertActivatableState,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterIsCreator,
  assertRequesterCanRetrievePurposeTemplate,
  validateAndTransformRiskAnalysisTemplate,
  validateRiskAnalysisTemplateOrThrow,
  assertSuspendableState,
  assertArchivableState,
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
    async archivePurposeTemplate(
      id: PurposeTemplateId,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Archiving purpose template ${id}`);

      const purposeTemplate = await retrievePurposeTemplate(
        id,
        readModelService
      );

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertArchivableState(purposeTemplate.data);

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        state: purposeTemplateState.archived,
        updatedAt: new Date(),
      };

      const createdEvent = await repository.createEvent(
        toCreateEventPurposeTemplateArchived({
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
    throw missingRiskAnalysisFormTemplate(purposeTemplate.data.id);
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
