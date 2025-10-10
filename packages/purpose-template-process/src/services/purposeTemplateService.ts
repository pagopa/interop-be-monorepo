import {
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  TenantKind,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  FileManager,
  getLatestVersionFormRules,
  Logger,
  M2MAdminAuthData,
  M2MAuthData,
  riskAnalysisValidatedAnswerToRiskAnalysisAnswer,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  associationEServicesForPurposeTemplateFailed,
  disassociationEServicesFromPurposeTemplateFailed,
  purposeTemplateNotFound,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateDraftDeleted,
  toCreateEventPurposeTemplateDraftUpdated,
  toCreateEventPurposeTemplateEServiceLinked,
  toCreateEventPurposeTemplateEServiceUnlinked,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import { cleanupAnnotationDocsForRemovedAnswers } from "../utilities/riskAnalysisDocUtils.js";
import {
  GetPurposeTemplateEServiceDescriptorsFilters,
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertEServiceIdsCountIsBelowThreshold,
  assertPurposeTemplateIsDraft,
  assertPurposeTemplateStateIsValid,
  assertPurposeTemplateHasRiskAnalysisForm,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterCanRetrievePurposeTemplate,
  assertRequesterIsCreator,
  assertRequesterPurposeTemplateCreator,
  validateAndTransformRiskAnalysisTemplate,
  validateEservicesAssociations,
  validateEservicesDisassociations,
  validateRiskAnalysisAnswerOrThrow,
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

/*
Deletes all the annotations documents associated to the purpose template
*/
async function deleteAllRiskAnalysisTemplateAnswerAnnotationDocuments({
  purposeTemplate,
  fileManager,
  readModelService,
  logger,
}: {
  purposeTemplate: PurposeTemplate;
  fileManager: FileManager;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
}): Promise<void> {
  if (!purposeTemplate.purposeRiskAnalysisForm) {
    throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplate.id);
  }

  const annotationDocuments =
    await readModelService.getRiskAnalysisTemplateAnswerAnnotationDocsByPurposeTemplateId(
      purposeTemplate.id
    );

  await Promise.all(
    annotationDocuments.map(async (doc) => {
      await fileManager.delete(config.s3Bucket, doc.path, logger);
    })
  );
}

/*
Deletes all the documents associated to one purpose template answer annotation
*/
async function deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
  purposeTemplateId,
  answerId,
  fileManager,
  readModelService,
  logger,
}: {
  purposeTemplateId: PurposeTemplateId;
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
  fileManager: FileManager;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
}): Promise<
  RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
> {
  const answer = await readModelService.getRiskAnalysisTemplateAnswer(
    purposeTemplateId,
    answerId
  );
  if (!answer) {
    throw riskAnalysisTemplateAnswerNotFound(purposeTemplateId, answerId);
  }

  if (!answer.annotation) {
    throw riskAnalysisTemplateAnswerAnnotationNotFound(
      purposeTemplateId,
      answerId
    );
  }

  await Promise.all(
    answer.annotation.docs.map(async (doc) => {
      await fileManager.delete(config.s3Bucket, doc.path, logger);
    })
  );

  return {
    ...answer,
    annotation: undefined,
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
    async getRiskAnalysisTemplateAnswerAnnotationDocument(
      {
        purposeTemplateId,
        answerId,
        documentId,
      }: {
        purposeTemplateId: PurposeTemplateId;
        answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
        documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId;
      },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument>> {
      logger.info(
        `Retrieving risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      const annotationDocument =
        await readModelService.getRiskAnalysisTemplateAnswerAnnotationDocument(
          purposeTemplateId,
          documentId
        );

      if (!annotationDocument) {
        throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
          purposeTemplateId,
          answerId,
          documentId
        );
      }

      return annotationDocument;
    },
    async getPurposeTemplateEServiceDescriptors(
      filters: GetPurposeTemplateEServiceDescriptorsFilters,
      { offset, limit }: { offset: number; limit: number },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<EServiceDescriptorPurposeTemplate>> {
      const { purposeTemplateId } = filters;

      logger.info(
        `Retrieving e-service descriptors linked to purpose template ${purposeTemplateId} with filters: ${JSON.stringify(
          filters
        )}`
      );

      await retrievePurposeTemplate(purposeTemplateId, readModelService);

      return await readModelService.getPurposeTemplateEServiceDescriptors(
        filters,
        {
          offset,
          limit,
        }
      );
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
        toCreateEventPurposeTemplateDraftUpdated(
          updatedPurposeTemplate,
          correlationId,
          purposeTemplate.metadata.version
        )
      );

      return {
        data: updatedPurposeTemplate,
        metadata: {
          version: event.newVersion,
        },
      };
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

      assertPurposeTemplateStateIsValid(purposeTemplate.data, [
        purposeTemplateState.draft,
      ]);

      // Check if the requester is the creator of the purpose template
      assertRequesterPurposeTemplateCreator(
        purposeTemplate.data.creatorId,
        authData
      );

      const validatedAnswer = validateRiskAnalysisAnswerOrThrow({
        riskAnalysisAnswer: riskAnalysisTemplateAnswerRequest,
        tenantKind: purposeTemplate.data.targetTenantKind,
      });

      const riskAnalysisForm = purposeTemplate.data.purposeRiskAnalysisForm;

      const { purposeRiskAnalysisForm, answer } = match(validatedAnswer)
        .with({ type: "single" }, (a) => {
          const singleAnswer =
            riskAnalysisValidatedAnswerToRiskAnalysisAnswer(a);
          return {
            purposeRiskAnalysisForm: {
              ...riskAnalysisForm,
              singleAnswers: [...riskAnalysisForm.singleAnswers, singleAnswer],
            },
            answer: singleAnswer,
          };
        })
        .with({ type: "multi" }, (a) => {
          const multiAnswer =
            riskAnalysisValidatedAnswerToRiskAnalysisAnswer(a);
          return {
            purposeRiskAnalysisForm: {
              ...riskAnalysisForm,
              multiAnswers: [...riskAnalysisForm.multiAnswers, multiAnswer],
            },
            answer: multiAnswer,
          };
        })
        .exhaustive();

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        updatedAt: new Date(),
        purposeRiskAnalysisForm,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateDraftUpdated(
          updatedPurposeTemplate,
          correlationId,
          purposeTemplate.metadata.version
        )
      );

      return {
        data: answer,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async deletePurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<void> {
      logger.info(`Deleting purpose template ${purposeTemplateId}`);

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertPurposeTemplateIsDraft(purposeTemplate.data);

      await deleteAllRiskAnalysisTemplateAnswerAnnotationDocuments({
        purposeTemplate: purposeTemplate.data,
        fileManager,
        readModelService,
        logger,
      });

      await repository.createEvent(
        toCreateEventPurposeTemplateDraftDeleted(
          purposeTemplate.data,
          correlationId,
          purposeTemplate.metadata.version
        )
      );
    },
    async deleteRiskAnalysisTemplateAnswerAnnotation({
      purposeTemplateId,
      answerId,
      ctx,
    }: {
      purposeTemplateId: PurposeTemplateId;
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>;
    }): Promise<
      WithMetadata<
        RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
      >
    > {
      const { authData, logger, correlationId } = ctx;

      logger.info(
        `Deleting risk analysis template answer annotation for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      const purposeTemplate = await retrievePurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      const purposeRiskAnalysisTemplateForm =
        purposeTemplate.data.purposeRiskAnalysisForm;
      if (!purposeRiskAnalysisTemplateForm) {
        throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplateId);
      }

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertPurposeTemplateIsDraft(purposeTemplate.data);

      const answerWithDeletedAnnotation =
        await deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
          purposeTemplateId,
          answerId,
          fileManager,
          readModelService,
          logger,
        });

      const updateAnswerWithoutAnnotation = <
        T extends
          | RiskAnalysisTemplateSingleAnswer
          | RiskAnalysisTemplateMultiAnswer
      >(
        answer: T
      ): T =>
        answer.id === answerId ? { ...answer, annotation: undefined } : answer;

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate.data,
        purposeRiskAnalysisForm: {
          ...purposeRiskAnalysisTemplateForm,
          singleAnswers: purposeRiskAnalysisTemplateForm.singleAnswers.map(
            updateAnswerWithoutAnnotation
          ),
          multiAnswers: purposeRiskAnalysisTemplateForm.multiAnswers.map(
            updateAnswerWithoutAnnotation
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
        data: answerWithDeletedAnnotation,
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
