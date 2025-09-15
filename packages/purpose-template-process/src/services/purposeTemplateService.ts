import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  M2MAdminAuthData,
  M2MAuthData,
  riskAnalysisFormTemplateToRiskAnalysisFormTemplateToValidate,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  missingRiskAnalysisFormTemplate,
  purposeTemplateNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplatePublished,
} from "../model/domain/toEvent.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertPublishableState,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterIsCreator,
  validateAndTransformRiskAnalysisTemplate,
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
        throw missingRiskAnalysisFormTemplate(purposeTemplate.data.id);
      }

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertPublishableState(purposeTemplate.data);

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
