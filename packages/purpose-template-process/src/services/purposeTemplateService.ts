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
  PurposeTemplateState,
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
  EService,
  DescriptorId,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  FileManager,
  getLatestVersionFormRules,
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
  toCreateEventPurposeTemplateArchived,
  toCreateEventPurposeTemplateAnnotationDocumentDeleted,
  toCreateEventPurposeTemplateDraftDeleted,
  toCreateEventPurposeTemplateDraftUpdated,
  toCreateEventPurposeTemplateEServiceLinked,
  toCreateEventPurposeTemplateEServiceUnlinked,
  toCreateEventPurposeTemplatePublished,
  toCreateEventPurposeTemplateSuspended,
  toCreateEventPurposeTemplateUnsuspended,
  toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded,
} from "../model/domain/toEvent.js";
import {
  cleanupAnnotationDocsForRemovedAnswers,
  deleteRiskAnalysisTemplateAnswerAnnotationDocuments,
} from "../utilities/riskAnalysisDocUtils.js";
import {
  GetPurposeTemplateEServiceDescriptorsFilters,
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertActivatableState,
  assertAnnotationDocumentIsUnique,
  assertArchivableState,
  assertConsistentFreeOfCharge,
  assertEServiceIdsCountIsBelowThreshold,
  assertPurposeTemplateStateIsValid,
  assertPurposeTemplateIsDraft,
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
  assertSuspendableState,
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

const updatePurposeTemplateWithoutAnnotation = async (
  purposeTemplateId: PurposeTemplateId,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">,
  readModelService: ReadModelServiceSQL
): Promise<{
  updatedPurposeTemplate: WithMetadata<PurposeTemplate>;
  updatedAnswer:
    | RiskAnalysisTemplateSingleAnswer
    | RiskAnalysisTemplateMultiAnswer;
  annotationDocumentsToRemove: RiskAnalysisTemplateAnswerAnnotationDocument[];
}> => {
  const purposeTemplate = await retrievePurposeTemplate(
    purposeTemplateId,
    readModelService
  );

  assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
  assertPurposeTemplateIsDraft(purposeTemplate.data);
  assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate.data);

  const purposeTemplateRiskAnalysisForm =
    purposeTemplate.data.purposeRiskAnalysisForm;

  function removeAnnotation<
    T extends RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
  >(
    answers: T[],
    answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
  ): {
    updatedAnswers: T[];
    updatedAnswer:
      | RiskAnalysisTemplateSingleAnswer
      | RiskAnalysisTemplateMultiAnswer
      | undefined;
    annotationDocumentsToRemove: RiskAnalysisTemplateAnswerAnnotationDocument[];
  } {
    return answers.reduce(
      (
        acc: {
          updatedAnswers: T[];
          updatedAnswer:
            | RiskAnalysisTemplateSingleAnswer
            | RiskAnalysisTemplateMultiAnswer
            | undefined;
          annotationDocumentsToRemove: RiskAnalysisTemplateAnswerAnnotationDocument[];
        },
        answer
      ) => {
        if (answer.id === answerId) {
          const updatedAnswer = { ...answer, annotation: undefined };

          return {
            updatedAnswers: [...acc.updatedAnswers, updatedAnswer],
            updatedAnswer,
            annotationDocumentsToRemove: answer.annotation?.docs || [],
          };
        } else {
          return {
            ...acc,
            updatedAnswers: [...acc.updatedAnswers, answer],
          };
        }
      },
      {
        updatedAnswers: [],
        updatedAnswer: undefined,
        annotationDocumentsToRemove: [],
      }
    );
  }

  const {
    updatedAnswers: updatedSingleAnswers,
    updatedAnswer: updatedSingleAnswer,
    annotationDocumentsToRemove: annotationDocumentsToRemoveFromSingleAnswer,
  } = removeAnnotation(purposeTemplateRiskAnalysisForm.singleAnswers, answerId);
  const {
    updatedAnswers: updatedMultiAnswers,
    updatedAnswer: updatedMultiAnswer,
    annotationDocumentsToRemove: annotationDocumentsToRemoveFromMultiAnswer,
  } = removeAnnotation(purposeTemplateRiskAnalysisForm.multiAnswers, answerId);

  const updatedAnswer = updatedSingleAnswer || updatedMultiAnswer;
  if (!updatedAnswer) {
    throw riskAnalysisTemplateAnswerNotFound(purposeTemplate.data.id, answerId);
  }

  const annotationDocumentsToRemove = [
    ...annotationDocumentsToRemoveFromSingleAnswer,
    ...annotationDocumentsToRemoveFromMultiAnswer,
  ];

  return {
    updatedPurposeTemplate: {
      data: {
        ...purposeTemplate.data,
        purposeRiskAnalysisForm: {
          ...purposeTemplateRiskAnalysisForm,
          singleAnswers: updatedSingleAnswers,
          multiAnswers: updatedMultiAnswers,
        },
      },
      metadata: purposeTemplate.metadata,
    },
    updatedAnswer,
    annotationDocumentsToRemove,
  };
};

const updatePurposeTemplateWithoutAnnotationDocument = async (
  purposeTemplateId: PurposeTemplateId,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">,
  readModelService: ReadModelServiceSQL
): Promise<{
  updatedPurposeTemplate: WithMetadata<PurposeTemplate>;
  removedAnnotationDocument: RiskAnalysisTemplateAnswerAnnotationDocument;
}> => {
  const purposeTemplate = await retrievePurposeTemplate(
    purposeTemplateId,
    readModelService
  );

  assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
  assertPurposeTemplateIsDraft(purposeTemplate.data);
  assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate.data);

  const purposeTemplateRiskAnalysisForm =
    purposeTemplate.data.purposeRiskAnalysisForm;

  function removeAnnotationDocument<
    T extends RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
  >(
    answers: T[],
    answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
    documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId
  ): {
    updatedAnswers: T[];
    removedAnnotationDocument:
      | RiskAnalysisTemplateAnswerAnnotationDocument
      | undefined;
  } {
    return answers.reduce(
      (
        acc: {
          updatedAnswers: T[];
          removedAnnotationDocument:
            | RiskAnalysisTemplateAnswerAnnotationDocument
            | undefined;
        },
        answer
      ) => {
        if (answer.id === answerId) {
          const { updatedAnnotationDocs, removedAnnotationDocument } = (
            answer.annotation?.docs || []
          ).reduce(
            (
              acc: {
                updatedAnnotationDocs: RiskAnalysisTemplateAnswerAnnotationDocument[];
                removedAnnotationDocument:
                  | RiskAnalysisTemplateAnswerAnnotationDocument
                  | undefined;
              },
              doc
            ) =>
              doc.id === documentId
                ? { ...acc, removedAnnotationDocument: doc }
                : {
                    ...acc,
                    updatedAnnotationDocs: [...acc.updatedAnnotationDocs, doc],
                  },
            {
              updatedAnnotationDocs: [],
              removedAnnotationDocument: undefined,
            }
          );

          return {
            updatedAnswers: [
              ...acc.updatedAnswers,
              {
                ...answer,
                annotation: {
                  ...answer.annotation,
                  docs: updatedAnnotationDocs,
                },
              },
            ],
            removedAnnotationDocument,
          };
        } else {
          return {
            ...acc,
            updatedAnswers: [...acc.updatedAnswers, answer],
          };
        }
      },
      {
        updatedAnswers: [],
        removedAnnotationDocument: undefined,
      }
    );
  }

  const {
    updatedAnswers: updatedSingleAnswers,
    removedAnnotationDocument: removedSingleAnswerAnnotationDocument,
  } = removeAnnotationDocument(
    purposeTemplateRiskAnalysisForm.singleAnswers,
    answerId,
    documentId
  );
  const {
    updatedAnswers: updatedMultiAnswers,
    removedAnnotationDocument: removedMultiAnswerAnnotationDocument,
  } = removeAnnotationDocument(
    purposeTemplateRiskAnalysisForm.multiAnswers,
    answerId,
    documentId
  );

  const removedAnnotationDocument =
    removedSingleAnswerAnnotationDocument ||
    removedMultiAnswerAnnotationDocument;
  if (!removedAnnotationDocument) {
    throw riskAnalysisTemplateAnswerAnnotationDocumentNotFound(
      purposeTemplate.data.id,
      answerId,
      documentId
    );
  }

  return {
    updatedPurposeTemplate: {
      data: {
        ...purposeTemplate.data,
        purposeRiskAnalysisForm: {
          ...purposeTemplateRiskAnalysisForm,
          singleAnswers: updatedSingleAnswers,
          multiAnswers: updatedMultiAnswers,
        },
      },
      metadata: purposeTemplate.metadata,
    },
    removedAnnotationDocument,
  };
};

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

  function linkOrUnlinkValidationResultsToEServiceDescriptorPurposeTemplate(
    purposeTemplateValidationResults: Array<{
      eservice: EService;
      descriptorId: DescriptorId;
    }>,
    purposeTemplateId: PurposeTemplateId,
    creationTimestamp: Date,
    createdEvents: Awaited<ReturnType<typeof repository.createEvents>>
  ): Array<WithMetadata<EServiceDescriptorPurposeTemplate>> {
    return purposeTemplateValidationResults.map(
      (purposeTemplateValidationResult) => ({
        data: {
          purposeTemplateId,
          eserviceId: purposeTemplateValidationResult.eservice.id,
          descriptorId: purposeTemplateValidationResult.descriptorId,
          createdAt: creationTimestamp,
        },
        metadata: {
          version: createdEvents[createdEvents.length - 1].newVersion,
        },
      })
    );
  }

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
            seed.targetTenantKind,
            seed.handlesPersonalData
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
        handlesPersonalData: seed.handlesPersonalData,
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
          answerId,
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
    ): Promise<Array<WithMetadata<EServiceDescriptorPurposeTemplate>>> {
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
        purposeTemplateState.published,
      ]);

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

      const validationResult = await validateEservicesAssociations(
        eserviceIds,
        purposeTemplate.data,
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

      const createdEvents = await repository.createEvents(createEvents);

      return linkOrUnlinkValidationResultsToEServiceDescriptorPurposeTemplate(
        validationResult.value,
        purposeTemplateId,
        creationTimestamp,
        createdEvents
      );
    },
    async unlinkEservicesFromPurposeTemplate(
      purposeTemplateId: PurposeTemplateId,
      eserviceIds: EServiceId[],
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<Array<WithMetadata<EServiceDescriptorPurposeTemplate>>> {
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
        purposeTemplateState.published,
      ]);

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);

      const validationResult = await validateEservicesDisassociations(
        eserviceIds,
        purposeTemplate.data,
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

      const createdEvents = await repository.createEvents(createEvents);

      return linkOrUnlinkValidationResultsToEServiceDescriptorPurposeTemplate(
        validationResult.value,
        purposeTemplateId,
        creationTimestamp,
        createdEvents
      );
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
              purposeTemplate.data.targetTenantKind,
              purposeTemplateSeed.handlesPersonalData
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
        authData,
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

      assertRequesterIsCreator(purposeTemplate.data.creatorId, authData);
      assertPurposeTemplateIsDraft(purposeTemplate.data);

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

      const updatedPurposeTemplate = await activatePurposeTemplate({
        id,
        expectedInitialState: purposeTemplateState.draft,
        authData,
        readModelService,
      });

      const createdEvent = await repository.createEvent(
        toCreateEventPurposeTemplatePublished(
          updatedPurposeTemplate.data,
          updatedPurposeTemplate.metadata.version,
          correlationId
        )
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
      assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate.data);

      const annotationDocumentsToRemove: RiskAnalysisTemplateAnswerAnnotationDocument[] =
        [
          ...purposeTemplate.data.purposeRiskAnalysisForm.singleAnswers,
          ...purposeTemplate.data.purposeRiskAnalysisForm.multiAnswers,
        ]
          .filter((a) => a.annotation)
          .flatMap((a) => a.annotation?.docs || []);

      await deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
        annotationDocumentsToRemove,
        fileManager,
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
      const { logger, correlationId, authData } = ctx;

      logger.info(
        `Deleting risk analysis template answer annotation for purpose template ${purposeTemplateId} and answer ${answerId}`
      );

      const {
        updatedPurposeTemplate,
        updatedAnswer,
        annotationDocumentsToRemove,
      } = await updatePurposeTemplateWithoutAnnotation(
        purposeTemplateId,
        answerId,
        authData,
        readModelService
      );

      await deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
        annotationDocumentsToRemove,
        fileManager,
        logger,
      });

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateDraftUpdated(
          updatedPurposeTemplate.data,
          correlationId,
          updatedPurposeTemplate.metadata.version
        )
      );

      return {
        data: updatedAnswer,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async deleteRiskAnalysisTemplateAnswerAnnotationDocument({
      purposeTemplateId,
      answerId,
      documentId,
      ctx,
    }: {
      purposeTemplateId: PurposeTemplateId;
      answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId;
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId;
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>;
    }): Promise<WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument>> {
      const { logger, correlationId, authData } = ctx;

      logger.info(
        `Deleting risk analysis template answer annotation document ${documentId} for purpose template ${purposeTemplateId}, answer ${answerId}`
      );

      const { updatedPurposeTemplate, removedAnnotationDocument } =
        await updatePurposeTemplateWithoutAnnotationDocument(
          purposeTemplateId,
          answerId,
          documentId,
          authData,
          readModelService
        );

      await deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
        annotationDocumentsToRemove: [removedAnnotationDocument],
        fileManager,
        logger,
      });

      const event = await repository.createEvent(
        toCreateEventPurposeTemplateAnnotationDocumentDeleted({
          purposeTemplate: updatedPurposeTemplate.data,
          documentId,
          version: updatedPurposeTemplate.metadata.version,
          correlationId,
        })
      );

      return {
        data: removedAnnotationDocument,
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
    personalDataInPurposeTemplate: purposeTemplate.data.handlesPersonalData,
  });

  return {
    data: {
      ...purposeTemplate.data,
      state: purposeTemplateState.published,
      updatedAt: new Date(),
    },
    metadata: purposeTemplate.metadata,
  };
}
