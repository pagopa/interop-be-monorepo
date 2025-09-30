import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  WithMetadata,
  purposeTemplateEventToBinaryDataV2,
  ListResult,
  RiskAnalysisFormTemplate,
  TenantKind,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
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
  UIAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  purposeTemplateNotFound,
  riskAnalysisTemplateAnswerAnnotationNotFound,
  riskAnalysisTemplateAnswerNotFound,
  riskAnalysisTemplateNotFound,
  ruleSetNotFoundError,
} from "../model/domain/errors.js";
import {
  toCreateEventPurposeTemplateAdded,
  toCreateEventPurposeTemplateDraftDeleted,
  toCreateEventPurposeTemplateDraftUpdated,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import {
  GetPurposeTemplatesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";
import {
  assertConsistentFreeOfCharge,
  assertPurposeTemplateIsDraft,
  assertPurposeTemplateTitleIsNotDuplicated,
  assertRequesterCanRetrievePurposeTemplate,
  assertRequesterIsCreator,
  validateAndTransformRiskAnalysisTemplate,
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
    return;
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
    answer.annotation
      ? answer.annotation.docs.map(async (doc) => {
          await fileManager.delete(config.s3Bucket, doc.path, logger);
        })
      : []
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

      assertRequesterIsCreator(purposeTemplate.data, authData);
      assertPurposeTemplateIsDraft(purposeTemplate.data);

      await deleteAllRiskAnalysisTemplateAnswerAnnotationDocuments({
        purposeTemplate: purposeTemplate.data,
        fileManager,
        readModelService,
        logger,
      });

      await repository.createEvent(
        toCreateEventPurposeTemplateDraftDeleted({
          purposeTemplate: purposeTemplate.data,
          version: purposeTemplate.metadata.version,
          correlationId,
        })
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
        throw riskAnalysisTemplateNotFound(purposeTemplateId);
      }

      assertRequesterIsCreator(purposeTemplate.data, authData);
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
        toCreateEventPurposeTemplateDraftUpdated({
          purposeTemplate: updatedPurposeTemplate,
          version: purposeTemplate.metadata.version,
          correlationId,
        })
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
