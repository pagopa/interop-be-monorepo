import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  getLatestVersionFormRules,
  FileManager,
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  ListResult,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
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
  associationEServicesForPurposeTemplateFailed,
  disassociationEServicesFromPurposeTemplateFailed,
  riskAnalysisAnswerNotFound,
  riskAnalysisFormTemplateNotFound,
  riskAnalysisAnswerAnnotationNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateDraftUpdated,
  toCreateEventPurposeTemplateEServiceLinked,
  toCreateEventPurposeTemplateEServiceUnlinked,
  toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded,
} from "../model/domain/toEvent.js";
import { cleanupAnnotationDocsForRemovedAnswers } from "../utilities/riskAnalysisDocUtils.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertAnnotationDocumentIsUnique,
  assertConsistentFreeOfCharge,
  assertEServiceIdsCountIsBelowThreshold,
  assertPurposeTemplateIsDraft,
  assertPurposeTemplateStateIsValid,
  assertRequesterIsCreator,
  assertDocumentsLimitsNotReached,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertTemplateStateNotDraft,
  validateAndTransformRiskAnalysisTemplate,
  validateEservicesAssociations,
  validateEservicesDisassociations,
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
      id: PurposeTemplateId,
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeTemplate>> {
      logger.info(`Retrieving purpose template ${id}`);
      return retrievePurposeTemplate(id, readModelService);
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
