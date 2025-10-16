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
  RiskAnalysisTemplateAnswer,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateAnswerAnnotationId,
  TenantKind,
  unsafeBrandId,
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
  riskAnalysisValidatedAnswerToRiskAnalysisAnswer,
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  purposeTemplateNotFound,
  associationEServicesForPurposeTemplateFailed,
  disassociationEServicesFromPurposeTemplateFailed,
  purposeTemplateRiskAnalysisFormNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerNotFound,
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  ruleSetNotFoundError,
  riskAnalysisAnswerNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateDraftUpdated,
  toCreateEventPurposeTemplateEServiceLinked,
  toCreateEventPurposeTemplateEServiceUnlinked,
  toCreateEventPurposeTemplatePublished,
  toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded,
} from "../model/domain/toEvent.js";
import { cleanupAnnotationDocsForRemovedAnswers } from "../utilities/riskAnalysisDocUtils.js";
import {
  GetPurposeTemplateEServiceDescriptorsFilters,
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertActivatableState,
  assertAnnotationDocumentIsUnique,
  assertConsistentFreeOfCharge,
  assertEServiceIdsCountIsBelowThreshold,
  assertPurposeTemplateIsDraft,
  assertPurposeTemplateStateIsValid,
  assertPurposeTemplateHasRiskAnalysisForm,
  validateRiskAnalysisAnswerAnnotationOrThrow,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterCanRetrievePurposeTemplate,
  assertRequesterIsCreator,
  assertDocumentsLimitsNotReached,
  validateAndTransformRiskAnalysisTemplate,
  validateEservicesAssociations,
  validateEservicesDisassociations,
  validateRiskAnalysisTemplateOrThrow,
  validateRiskAnalysisAnswerOrThrow,
  assertPurposeTemplateStateIsNotDraft,
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
    throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplate.id);
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

  throw riskAnalysisTemplateAnswerNotFound(
    purposeTemplateId,
    unsafeBrandId(answerId)
  );
}

function retrieveAnswerAnnotation(
  { answer }: RiskAnalysisTemplateAnswer,
  purposeTemplateId: PurposeTemplateId
): RiskAnalysisTemplateAnswerAnnotation {
  if (!answer?.annotation) {
    throw riskAnalysisTemplateAnswerAnnotationNotFound(
      purposeTemplateId,
      answer.id
    );
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

      if (
        purposeTemplateSeed.purposeTitle &&
        purposeTemplateSeed.purposeTitle.toLowerCase() !==
          purposeTemplate.data.purposeTitle.toLowerCase()
      ) {
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
        updatedAt: new Date(),
        ...(!purposeTemplateSeed.purposeIsFreeOfCharge && {
          purposeFreeOfChargeReason: undefined,
        }),
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

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

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

      assertPurposeTemplateStateIsNotDraft(purposeTemplate.data);

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
        body.prettyName,
        body.checksum
      );

      const oldAnnotation = retrieveAnswerAnnotation(
        answerToUpdate,
        purposeTemplate.data.id
      );

      assertDocumentsLimitsNotReached(oldAnnotation.docs, answerId);

      const newAnnotationDocument: RiskAnalysisTemplateAnswerAnnotationDocument =
        {
          id: unsafeBrandId(body.documentId),
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

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

      assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate.data);

      assertPurposeTemplateStateIsValid(purposeTemplate.data, [
        purposeTemplateState.draft,
      ]);

      const riskAnalysisForm = purposeTemplate.data.purposeRiskAnalysisForm;

      const answerAndAnnotation = findAnswerAndAnnotation(
        riskAnalysisForm,
        answerId
      );

      if (answerAndAnnotation.annotation) {
        validateRiskAnalysisAnswerAnnotationOrThrow(
          answerAndAnnotation.annotation.text
        );
      }

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
        toCreateEventPurposeTemplatePublished(
          updatedPurposeTemplate,
          purposeTemplate.metadata.version,
          correlationId
        )
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
