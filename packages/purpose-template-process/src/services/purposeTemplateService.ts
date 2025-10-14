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
  riskAnalysisTemplateAnswerAnnotationDocumentNotFound,
  riskAnalysisTemplateAnswerNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateAnnotationDocumentDeleted,
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
  assertPurposeTemplateHasRiskAnalysisForm,
  assertPurposeTemplateIsDraft,
  assertPurposeTemplateObjectsAreDeletable,
  assertPurposeTemplateStateIsValid,
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

// Deletes all the annotations documents associated to the purpose template
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
  assertPurposeTemplateHasRiskAnalysisForm(purposeTemplate);

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

// Deletes the documents associated to one purpose template answer annotation
async function deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
  removedDocuments,
  fileManager,
  logger,
}: {
  removedDocuments: RiskAnalysisTemplateAnswerAnnotationDocument[];
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> {
  await Promise.all(
    removedDocuments.map(async (doc) => {
      await fileManager.delete(config.s3Bucket, doc.path, logger);
    })
  );
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
  removedAnnotationDocuments: RiskAnalysisTemplateAnswerAnnotationDocument[];
}> => {
  const purposeTemplate = await retrievePurposeTemplate(
    purposeTemplateId,
    readModelService
  );

  assertPurposeTemplateObjectsAreDeletable(purposeTemplate.data, authData);

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
    removedAnnotationDocuments: RiskAnalysisTemplateAnswerAnnotationDocument[];
  } {
    return answers.reduce(
      (
        acc: {
          updatedAnswers: T[];
          updatedAnswer:
            | RiskAnalysisTemplateSingleAnswer
            | RiskAnalysisTemplateMultiAnswer
            | undefined;
          removedAnnotationDocuments: RiskAnalysisTemplateAnswerAnnotationDocument[];
        },
        answer
      ) => {
        if (answer.id === answerId) {
          const updatedAnswer = { ...answer, annotation: undefined };

          return {
            updatedAnswers: [...acc.updatedAnswers, updatedAnswer],
            updatedAnswer,
            removedAnnotationDocuments: answer.annotation?.docs || [],
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
        removedAnnotationDocuments: [],
      }
    );
  }

  const {
    updatedAnswers: updatedSingleAnswers,
    updatedAnswer: updatedSingleAnswer,
    removedAnnotationDocuments: removedAnnotationDocumentsFromSingleAnswer,
  } = removeAnnotation(purposeTemplateRiskAnalysisForm.singleAnswers, answerId);
  const {
    updatedAnswers: updatedMultiAnswers,
    updatedAnswer: updatedMultiAnswer,
    removedAnnotationDocuments: removedAnnotationDocumentsFromMultiAnswer,
  } = removeAnnotation(purposeTemplateRiskAnalysisForm.multiAnswers, answerId);

  const updatedAnswer = updatedSingleAnswer || updatedMultiAnswer;
  if (!updatedAnswer) {
    throw riskAnalysisTemplateAnswerNotFound(purposeTemplate.data.id, answerId);
  }

  const removedAnnotationDocuments = [
    ...removedAnnotationDocumentsFromSingleAnswer,
    ...removedAnnotationDocumentsFromMultiAnswer,
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
    removedAnnotationDocuments,
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

  assertPurposeTemplateObjectsAreDeletable(purposeTemplate.data, authData);

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

      assertPurposeTemplateObjectsAreDeletable(purposeTemplate.data, authData);

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
      const { logger, correlationId, authData } = ctx;

      logger.info(
        `Deleting risk analysis template answer annotation for purpose template ${purposeTemplateId}, answer ${answerId}`
      );

      const {
        updatedPurposeTemplate,
        updatedAnswer,
        removedAnnotationDocuments,
      } = await updatePurposeTemplateWithoutAnnotation(
        purposeTemplateId,
        answerId,
        authData,
        readModelService
      );

      await deleteRiskAnalysisTemplateAnswerAnnotationDocuments({
        removedDocuments: removedAnnotationDocuments,
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
    }): Promise<void> {
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
        removedDocuments: [removedAnnotationDocument],
        fileManager,
        logger,
      });

      await repository.createEvent(
        toCreateEventPurposeTemplateAnnotationDocumentDeleted({
          purposeTemplate: updatedPurposeTemplate.data,
          documentId,
          version: updatedPurposeTemplate.metadata.version,
          correlationId,
        })
      );
    },
  };
}
export type PurposeTemplateService = ReturnType<
  typeof purposeTemplateServiceBuilder
>;
