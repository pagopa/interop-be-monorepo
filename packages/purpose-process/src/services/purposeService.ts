/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import { purposeApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  AuthData,
  CreateEvent,
  DB,
  InternalAuthData,
  M2MAdminAuthData,
  M2MAuthData,
  Ownership,
  RiskAnalysisFormRules,
  RiskAnalysisFormToValidate,
  UIAuthData,
  WithLogger,
  eventRepository,
  formatDateddMMyyyyHHmmss,
  getFormRulesByVersion,
  getLatestVersionFormRules,
  assertFeatureFlagEnabled,
  isFeatureFlagEnabled,
  ownership,
  riskAnalysisFormToRiskAnalysisFormToValidate,
} from "pagopa-interop-commons";
import {
  Agreement,
  CorrelationId,
  Delegation,
  DelegationId,
  EService,
  EServiceId,
  ListResult,
  Purpose,
  PurposeEvent,
  PurposeId,
  PurposeRiskAnalysisForm,
  PurposeTemplate,
  PurposeTemplateId,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  PurposeVersionId,
  PurposeVersionSignedDocument,
  PurposeVersionStamps,
  RiskAnalysis,
  RiskAnalysisId,
  RiskAnalysisReviewMode,
  RiskAnalysisSigningState,
  ReviewerWorkflow,
  Tenant,
  TenantId,
  TenantKind,
  WithMetadata,
  eserviceMode,
  generateId,
  purposeEventToBinaryData,
  purposeVersionState,
  unsafeBrandId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ClientId } from "pagopa-interop-models";
import { config } from "../config/config.js";
import {
  agreementNotFound,
  eserviceNotFound,
  eserviceRiskAnalysisNotFound,
  missingRiskAnalysis,
  notValidVersionState,
  purposeCannotBeCloned,
  purposeCannotBeDeleted,
  purposeCannotBeUpdated,
  purposeDelegationNotFound,
  purposeDraftVersionNotFound,
  purposeNotFound,
  purposeTemplateNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  purposeVersionStateConflict,
  riskAnalysisConfigLatestVersionNotFound,
  riskAnalysisConfigVersionNotFound,
  tenantIsNotTheConsumer,
  tenantIsNotTheProducer,
  tenantKindNotFound,
  tenantNotAllowed,
  tenantNotFound,
  unableToDetermineTenantKind,
  unchangedDailyCalls,
  reviewerWorkflowConflict,
  multipleReviewersNotAllowed,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotSubmittable,
  submitNotAllowedForReviewMode,
  reviewerWorkflowNotInSubmittedState,
  requesterIsNotDesignatedReviewer,
  rejectNotAllowedInCurrentMode,
  editNotAllowedForReviewMode,
  reviewerWorkflowNotEditable,
  reviewerWorkflowNotInSignedState,
} from "../model/domain/errors.js";
import {
  toCreateEventDraftPurposeDeleted,
  toCreateEventDraftPurposeUpdated,
  toCreateEventNewPurposeVersionActivated,
  toCreateEventNewPurposeVersionWaitingForApproval,
  toCreateEventPurposeActivated,
  toCreateEventPurposeAdded,
  toCreateEventPurposeArchived,
  toCreateEventPurposeCloned,
  toCreateEventPurposeDeletedByRevokedDelegation,
  toCreateEventPurposeSuspendedByConsumer,
  toCreateEventPurposeSuspendedByProducer,
  toCreateEventMaintenancePurposeRiskAnalysisSetTenantKind,
  toCreateEventPurposeVersionActivated,
  toCreateEventPurposeVersionArchivedByRevokedDelegation,
  toCreateEventPurposeVersionOverQuotaUnsuspended,
  toCreateEventPurposeVersionRejected,
  toCreateEventPurposeVersionUnsuspenedByConsumer,
  toCreateEventPurposeVersionUnsuspenedByProducer,
  toCreateEventPurposeWaitingForApproval,
  toCreateEventRiskAnalysisDocumentGenerated,
  toCreateEventWaitingForApprovalPurposeDeleted,
  toCreateEventWaitingForApprovalPurposeVersionDeleted,
  toCreateEventRiskAnalysisSignedDocumentGenerated,
  toCreateEventPurposeRiskAnalysisWorkflowCreated,
  toCreateEventPurposeRiskAnalysisAssigned,
  toCreateEventPurposeRiskAnalysisSubmitted,
  toCreateEventPurposeRiskAnalysisSigned,
  toCreateEventPurposeRiskAnalysisRejected,
  toCreateEventPurposeRiskAnalysisFormEdited,
} from "../model/domain/toEvent.js";
import {
  GetPurposesFilters as ReadModelGetPurposesFilters,
  ReadModelServiceSQL,
} from "./readModelServiceSQL.js";

type GetPurposesFilters = Omit<ReadModelGetPurposesFilters, "purposesIds"> & {
  clientId?: ClientId;
};
import {
  assertConsistentFreeOfCharge,
  assertEserviceMode,
  assertPersonalDataCompliant,
  assertPurposeIsDraft,
  assertPurposeIsNotFromTemplate,
  assertPurposeTitleIsNotDuplicated,
  assertRequesterCanActAsConsumer,
  assertRequesterCanActAsProducer,
  assertRequesterCanRetrievePurpose,
  assertValidPurposeTenantKind,
  getOrganizationRole,
  isArchivable,
  isClonable,
  isDeletable,
  isDeletableVersion,
  isOverQuota,
  isRejectable,
  isSuspendable,
  purposeIsArchived,
  purposeIsDraft,
  validateAndTransformRiskAnalysis,
  validateRiskAnalysisAgainstTemplateOrThrow,
  validateRiskAnalysisOrThrow,
  verifyRequesterIsConsumerOrDelegateConsumer,
  getUpdatedQuotas,
  assertRiskAnalysisTenantKindMatch,
  assertRequesterIsConsumer,
} from "./validators.js";

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<Purpose>> => {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (purpose === undefined) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
};

const retrievePurposeVersion = (
  versionId: PurposeVersionId,
  purpose: WithMetadata<Purpose>
): PurposeVersion => {
  const version = purpose.data.versions.find(
    (v: PurposeVersion) => v.id === versionId
  );

  if (version === undefined) {
    throw purposeVersionNotFound(purpose.data.id, versionId);
  }

  return version;
};

const retrieveDraftPurposeVersion = (purpose: Purpose): PurposeVersion => {
  const draftVersion = purpose.versions.find(
    (v) => v.state === purposeVersionState.draft
  );
  if (draftVersion === undefined) {
    throw purposeDraftVersionNotFound(purpose.id);
  }
  return draftVersion;
};

const retrievePurposeVersionDocument = (
  purposeId: PurposeId,
  purposeVersion: PurposeVersion,
  documentId: PurposeVersionDocumentId
): PurposeVersionDocument => {
  const document = purposeVersion.riskAnalysis;

  if (document === undefined || document.id !== documentId) {
    throw purposeVersionDocumentNotFound(
      purposeId,
      purposeVersion.id,
      documentId
    );
  }

  return document;
};

const retrievePurposeVersionSignedDocument = (
  purposeId: PurposeId,
  purposeVersion: PurposeVersion,
  documentId: PurposeVersionDocumentId
): PurposeVersionSignedDocument => {
  const document = purposeVersion.signedContract;

  if (document === undefined || document.id !== documentId) {
    throw purposeVersionDocumentNotFound(
      purposeId,
      purposeVersion.id,
      documentId
    );
  }

  return document;
};

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveActiveAgreement = async (
  eserviceId: EServiceId,
  consumerId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Agreement> => {
  const activeAgreement = await readModelService.getActiveAgreement(
    eserviceId,
    consumerId
  );
  if (activeAgreement === undefined) {
    throw agreementNotFound(eserviceId, consumerId);
  }
  return activeAgreement;
};

const retrieveRiskAnalysis = (
  riskAnalysisId: RiskAnalysisId,
  eservice: EService
): RiskAnalysis => {
  const riskAnalysis = eservice.riskAnalysis.find(
    (ra: RiskAnalysis) => ra.id === riskAnalysisId
  );

  if (riskAnalysis === undefined) {
    throw eserviceRiskAnalysisNotFound(eservice.id, riskAnalysisId);
  }

  return riskAnalysis;
};

async function retrieveTenantKind(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<TenantKind> {
  const tenant = await retrieveTenant(tenantId, readModelService);
  if (!tenant.kind) {
    throw tenantKindNotFound(tenant.id);
  }
  return tenant.kind;
}

export const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelServiceSQL
): Promise<Delegation | undefined> => {
  if (!purpose.delegationId) {
    return undefined;
  }
  const delegation =
    await readModelService.getActiveConsumerDelegationByDelegationId(
      purpose.delegationId
    );
  if (!delegation) {
    throw purposeDelegationNotFound(purpose.id, purpose.delegationId);
  }
  return delegation;
};

async function retrievePublishedPurposeTemplate(
  templateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<PurposeTemplate> {
  const purposeTemplate =
    await readModelService.getPublishedPurposeTemplateById(templateId);
  if (!purposeTemplate) {
    throw purposeTemplateNotFound(templateId);
  }
  return purposeTemplate;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  const repository = eventRepository(dbInstance, purposeEventToBinaryData);

  return {
    async getPurposeById(
      purposeId: PurposeId,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      await assertRequesterCanRetrievePurpose(
        purpose.data,
        eservice,
        authData,
        readModelService
      );

      return purpose;
    },
    async fixPurposeRiskAnalysisTenantKind(
      purposeId: PurposeId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Fixing Risk Analysis for Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const riskAnalysisForm = purpose.data.riskAnalysisForm;
      if (!riskAnalysisForm) {
        throw missingRiskAnalysis(purposeId);
      }

      const eservice = await readModelService.getEServiceById(
        purpose.data.eserviceId
      );
      if (!eservice) {
        throw eserviceNotFound(purpose.data.eserviceId);
      }

      const tenantId =
        eservice.mode === eserviceMode.deliver
          ? purpose.data.consumerId
          : eservice.producerId;

      const firstPublishedAt = eservice.descriptors
        .map((d) => d.publishedAt)
        .filter((d): d is Date => d !== undefined)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      const matchingRiskAnalysisCreatedAt = riskAnalysisForm.riskAnalysisId
        ? eservice.riskAnalysis.find(
            (ra) => ra.id === riskAnalysisForm.riskAnalysisId
          )?.createdAt
        : undefined;

      const referenceDate = match(eservice.mode)
        .with(eserviceMode.deliver, () => purpose.data.createdAt)
        .with(
          eserviceMode.receive,
          () => matchingRiskAnalysisCreatedAt ?? firstPublishedAt
        )
        .exhaustive();

      if (!referenceDate) {
        throw unableToDetermineTenantKind(tenantId);
      }

      const historyKind = await readModelService.getTenantKindAt(
        tenantId,
        referenceDate
      );
      if (!historyKind) {
        throw tenantKindNotFound(tenantId);
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        riskAnalysisForm: {
          ...riskAnalysisForm,
          tenantKind: historyKind,
        },
      };

      const event = toCreateEventMaintenancePurposeRiskAnalysisSetTenantKind({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        correlationId,
      });

      const createdEvent = await repository.createEvent(event);

      return {
        data: updatedPurpose,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async getRiskAnalysisDocument({
      purposeId,
      versionId,
      documentId,
      ctx: { authData, logger },
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      documentId: PurposeVersionDocumentId;
      ctx: WithLogger<AppContext<UIAuthData>>;
    }): Promise<PurposeVersionDocument> {
      logger.info(
        `Retrieving Risk Analysis document ${documentId} in version ${versionId} of Purpose ${purposeId}`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      await assertRequesterCanRetrievePurpose(
        purpose.data,
        eservice,
        authData,
        readModelService
      );

      const version = retrievePurposeVersion(versionId, purpose);

      return retrievePurposeVersionDocument(purposeId, version, documentId);
    },
    async deletePurposeVersion(
      {
        purposeId,
        versionId,
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
      },
      {
        correlationId,
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Deleting Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterCanActAsConsumer(
        purpose.data,
        authData,
        await retrievePurposeDelegation(purpose.data, readModelService)
      );

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isDeletableVersion(purposeVersion, purpose.data)) {
        throw purposeVersionCannotBeDeleted(purposeId, versionId);
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.id !== purposeVersion.id
        ),
        updatedAt: new Date(),
      };

      const event = await repository.createEvent(
        toCreateEventWaitingForApprovalPurposeVersionDeleted({
          purpose: updatedPurpose,
          version: purpose.metadata.version,
          versionId,
          correlationId,
        })
      );

      return {
        data: updatedPurpose,
        metadata: { version: event.newVersion },
      };
    },
    async assignRiskAnalysisReviewer(
      purposeId: PurposeId,
      seed: {
        reviewMode: RiskAnalysisReviewMode;
        reviewerIds: string[];
      },
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Assigning risk analysis reviewer to Purpose ${purposeId}`);

      assertFeatureFlagEnabled(config, "featureFlagNewOperators");

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterIsConsumer(purpose.data, authData);

      if (purpose.data.reviewerWorkflow !== undefined) {
        throw reviewerWorkflowConflict(purposeId);
      }

      const isReviewerWrites =
        seed.reviewMode === riskAnalysisReviewMode.reviewerWritesReviewerSigns;

      if (seed.reviewerIds.length > 1) {
        throw multipleReviewersNotAllowed(purposeId);
      }

      const reviewerWorkflow: ReviewerWorkflow = {
        reviewMode: seed.reviewMode,
        reviewerIds: seed.reviewerIds.map((id) => unsafeBrandId(id)),
        signingState: isReviewerWrites
          ? RiskAnalysisSigningState.Values.Assigned
          : RiskAnalysisSigningState.Values.Draft,
        sentToReviewerAt: isReviewerWrites ? new Date() : undefined,
      };

      const updatedPurpose: Purpose = {
        ...purpose.data,
        reviewerWorkflow,
        updatedAt: new Date(),
      };

      const event = await repository.createEvent(
        isReviewerWrites
          ? toCreateEventPurposeRiskAnalysisAssigned({
              purpose: updatedPurpose,
              version: purpose.metadata.version,
              correlationId,
            })
          : toCreateEventPurposeRiskAnalysisWorkflowCreated({
              purpose: updatedPurpose,
              version: purpose.metadata.version,
              correlationId,
            })
      );

      return {
        data: updatedPurpose,
        metadata: { version: event.newVersion },
      };
    },
    async submitRiskAnalysis(
      purposeId: PurposeId,
      seed: {
        riskAnalysisForm: purposeApi.RiskAnalysisFormSeed;
      },
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Submitting risk analysis for Purpose ${purposeId}`);

      assertFeatureFlagEnabled(config, "featureFlagNewOperators");

      const purpose = await retrievePurpose(purposeId, readModelService);

      const workflow = purpose.data.reviewerWorkflow;

      if (!workflow) {
        throw reviewerWorkflowNotFound(purposeId);
      }

      if (
        workflow.reviewMode !== riskAnalysisReviewMode.adminWritesReviewerSigns
      ) {
        throw submitNotAllowedForReviewMode(purposeId);
      }

      if (
        workflow.signingState !== riskAnalysisSigningState.draft &&
        workflow.signingState !== riskAnalysisSigningState.rejected
      ) {
        throw reviewerWorkflowNotSubmittable(purposeId);
      }

      assertRequesterIsConsumer(purpose.data, authData);

      const tenantKind = await retrieveTenantKind(
        purpose.data.consumerId,
        readModelService
      );
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const now = new Date();

      const riskAnalysisFormToValidate: RiskAnalysisFormToValidate = {
        ...seed.riskAnalysisForm,
        tenantKind,
      };

      const validatedRiskAnalysisForm = validateAndTransformRiskAnalysis(
        riskAnalysisFormToValidate,
        false,
        tenantKind,
        now,
        eservice.personalData
      );

      const updatedPurpose: Purpose = {
        ...purpose.data,
        riskAnalysisForm: validatedRiskAnalysisForm
          ? validatedRiskAnalysisForm
          : purpose.data.riskAnalysisForm,
        reviewerWorkflow: {
          ...workflow,
          signingState: riskAnalysisSigningState.submitted,
          rejectionReason: undefined,
          sentToReviewerAt: now,
        },
        updatedAt: now,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeRiskAnalysisSubmitted({
          purpose: updatedPurpose,
          version: purpose.metadata.version,
          correlationId,
        })
      );

      return {
        data: updatedPurpose,
        metadata: { version: event.newVersion },
      };
    },
    async signRiskAnalysis(
      purposeId: PurposeId,
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<
      WithMetadata<{ purpose: Purpose; isRiskAnalysisValid: boolean }>
    > {
      logger.info(`Signing risk analysis for Purpose ${purposeId}`);

      assertFeatureFlagEnabled(config, "featureFlagNewOperators");

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterIsConsumer(purpose.data, authData);

      const workflow = purpose.data.reviewerWorkflow;

      if (!workflow) {
        throw reviewerWorkflowNotFound(purposeId);
      }

      const isReviewerWritesSignable = match(workflow)
        .with(
          {
            reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
            signingState: riskAnalysisSigningState.submitted,
          },
          () => false
        )
        .with(
          {
            reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
            signingState: riskAnalysisSigningState.assigned,
          },
          () => true
        )
        .otherwise(() => {
          throw reviewerWorkflowNotInSubmittedState(purposeId);
        });

      if (!workflow.reviewerIds.includes(authData.userId)) {
        throw requesterIsNotDesignatedReviewer(purposeId);
      }

      if (isReviewerWritesSignable) {
        const riskAnalysisForm = purpose.data.riskAnalysisForm;

        if (!riskAnalysisForm) {
          throw missingRiskAnalysis(purposeId);
        }

        const [tenantKind, eservice] = await Promise.all([
          retrieveTenantKind(purpose.data.consumerId, readModelService),
          retrieveEService(purpose.data.eserviceId, readModelService),
        ]);

        validateRiskAnalysisOrThrow({
          riskAnalysisForm:
            riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
          schemaOnlyValidation: false,
          fallbackTenantKind: tenantKind,
          dateForExpirationValidation: new Date(),
          personalDataInEService: eservice.personalData,
        });
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        reviewerWorkflow: {
          ...workflow,
          signingState: riskAnalysisSigningState.signed,
          signedBy: authData.userId,
        },
        updatedAt: new Date(),
      };

      const event = await repository.createEvent(
        toCreateEventPurposeRiskAnalysisSigned({
          purpose: updatedPurpose,
          version: purpose.metadata.version,
          correlationId,
        })
      );

      return {
        data: { purpose: updatedPurpose, isRiskAnalysisValid: true },
        metadata: { version: event.newVersion },
      };
    },
    async rejectRiskAnalysis(
      purposeId: PurposeId,
      { rejectionReason }: { rejectionReason: string },
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Rejecting risk analysis for Purpose ${purposeId}`);

      assertFeatureFlagEnabled(config, "featureFlagNewOperators");

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterIsConsumer(purpose.data, authData);

      const workflow = purpose.data.reviewerWorkflow;

      if (!workflow) {
        throw reviewerWorkflowNotFound(purposeId);
      }

      if (workflow.signingState !== riskAnalysisSigningState.submitted) {
        throw reviewerWorkflowNotInSubmittedState(purposeId);
      }

      if (
        workflow.reviewMode !== riskAnalysisReviewMode.adminWritesReviewerSigns
      ) {
        throw rejectNotAllowedInCurrentMode(purposeId);
      }

      if (!workflow.reviewerIds.includes(authData.userId)) {
        throw requesterIsNotDesignatedReviewer(purposeId);
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        reviewerWorkflow: {
          ...workflow,
          signingState: riskAnalysisSigningState.rejected,
          rejectionReason,
        },
        updatedAt: new Date(),
      };

      const event = await repository.createEvent(
        toCreateEventPurposeRiskAnalysisRejected({
          purpose: updatedPurpose,
          version: purpose.metadata.version,
          correlationId,
        })
      );

      return {
        data: updatedPurpose,
        metadata: { version: event.newVersion },
      };
    },
    async editRiskAnalysisForm(
      purposeId: PurposeId,
      riskAnalysisFormSeed: purposeApi.RiskAnalysisFormSeed,
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(
        `Editing risk analysis form for Purpose ${purposeId} by reviewer`
      );

      assertFeatureFlagEnabled(config, "featureFlagNewOperators");

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterIsConsumer(purpose.data, authData);

      const workflow = purpose.data.reviewerWorkflow;

      if (!workflow) {
        throw reviewerWorkflowNotFound(purposeId);
      }

      if (
        workflow.reviewMode !==
        riskAnalysisReviewMode.reviewerWritesReviewerSigns
      ) {
        throw editNotAllowedForReviewMode(purposeId);
      }

      if (workflow.signingState !== riskAnalysisSigningState.assigned) {
        throw reviewerWorkflowNotEditable(purposeId);
      }

      if (!workflow.reviewerIds.includes(authData.userId)) {
        throw requesterIsNotDesignatedReviewer(purposeId);
      }

      const tenantKind = await retrieveTenantKind(
        purpose.data.consumerId,
        readModelService
      );
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const formToValidate: RiskAnalysisFormToValidate = {
        ...riskAnalysisFormSeed,
        tenantKind,
      };

      const validatedFormSeed = validateAndTransformRiskAnalysis(
        formToValidate,
        true,
        tenantKind,
        new Date(),
        eservice.personalData
      );

      const updatedPurpose: Purpose = {
        ...purpose.data,
        riskAnalysisForm: validatedFormSeed,
        updatedAt: new Date(),
      };

      const event = await repository.createEvent(
        toCreateEventPurposeRiskAnalysisFormEdited({
          purpose: updatedPurpose,
          version: purpose.metadata.version,
          correlationId,
        })
      );

      return {
        data: updatedPurpose,
        metadata: { version: event.newVersion },
      };
    },
    async rejectPurposeVersion(
      {
        purposeId,
        versionId,
        rejectionReason,
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
        rejectionReason: string;
      },
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Rejecting Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      assertRequesterCanActAsProducer(
        eservice,
        authData,
        await readModelService.getActiveProducerDelegationByEserviceId(
          purpose.data.eserviceId
        )
      );

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isRejectable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const updatedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.rejected,
        rejectionReason,
        updatedAt: new Date(),
      };

      const updatedPurpose = replacePurposeVersion(
        purpose.data,
        updatedPurposeVersion
      );

      const event = toCreateEventPurposeVersionRejected({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
    },
    async updatePurpose(
      purposeId: PurposeId,
      purposeUpdateContent: purposeApi.PurposeUpdateContent,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<UpdatePurposeReturn> {
      logger.info(`Updating Purpose ${purposeId}`);
      return await performUpdatePurpose(
        purposeId,
        {
          updateContent: purposeUpdateContent,
          mode: eserviceMode.deliver,
        },
        authData,
        readModelService,
        correlationId,
        repository
      );
    },
    async patchUpdatePurpose(
      purposeId: PurposeId,
      purposeUpdateContent: purposeApi.PatchPurposeUpdateContent,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<M2MAdminAuthData>>
    ): Promise<UpdatePurposeReturn> {
      logger.info(`Partially updating Purpose ${purposeId}`);
      return await performUpdatePurpose(
        purposeId,
        {
          updateContent: purposeUpdateContent,
          mode: eserviceMode.deliver,
        },
        authData,
        readModelService,
        correlationId,
        repository
      );
    },
    async updateReversePurpose(
      purposeId: PurposeId,
      reversePurposeUpdateContent: purposeApi.ReversePurposeUpdateContent,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<UpdatePurposeReturn> {
      logger.info(`Updating Reverse Purpose ${purposeId}`);
      return await performUpdatePurpose(
        purposeId,
        {
          updateContent: reversePurposeUpdateContent,
          mode: eserviceMode.receive,
        },
        authData,
        readModelService,
        correlationId,
        repository
      );
    },
    async patchUpdateReversePurpose(
      purposeId: PurposeId,
      reversePurposeUpdateContent: purposeApi.PatchReversePurposeUpdateContent,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<M2MAdminAuthData>>
    ): Promise<UpdatePurposeReturn> {
      logger.info(`Partially updating Purpose ${purposeId}`);
      return await performUpdatePurpose(
        purposeId,
        {
          updateContent: reversePurposeUpdateContent,
          mode: eserviceMode.receive,
        },
        authData,
        readModelService,
        correlationId,
        repository
      );
    },
    async deletePurpose(
      purposeId: PurposeId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<void> {
      logger.info(`Deleting Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      if (!isDeletable(purpose.data)) {
        throw purposeCannotBeDeleted(purpose.data.id);
      }

      assertRequesterCanActAsConsumer(
        purpose.data,
        authData,
        await retrievePurposeDelegation(purpose.data, readModelService)
      );

      const event = purposeIsDraft(purpose.data)
        ? toCreateEventDraftPurposeDeleted({
            purpose: purpose.data,
            version: purpose.metadata.version,
            correlationId,
          })
        : toCreateEventWaitingForApprovalPurposeDeleted({
            purpose: purpose.data,
            version: purpose.metadata.version,
            correlationId,
          });

      await repository.createEvent(event);
    },
    async internalDeletePurposeAfterDelegationRevocation(
      purposeId: PurposeId,
      delegationId: DelegationId,
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Deleting Purpose ${purposeId} due to revocation of delegation ${delegationId}`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);

      if (!isDeletable(purpose.data)) {
        throw purposeCannotBeDeleted(purpose.data.id);
      }

      if (
        !purpose.data.delegationId ||
        purpose.data.delegationId !== delegationId
      ) {
        throw purposeDelegationNotFound(purposeId, delegationId);
      }

      await repository.createEvent(
        toCreateEventPurposeDeletedByRevokedDelegation({
          purpose: purpose.data,
          delegationId,
          version: purpose.metadata.version,
          correlationId,
        })
      );
    },
    async archivePurposeVersion(
      {
        purposeId,
        versionId,
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeVersion>> {
      logger.info(`Archiving Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterCanActAsConsumer(
        purpose.data,
        authData,
        await retrievePurposeDelegation(purpose.data, readModelService)
      );

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isArchivable(purposeVersion)) {
        throw notValidVersionState(versionId, purposeVersion.state);
      }

      const purposeWithoutWaitingForApproval: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.state !== purposeVersionState.waitingForApproval
        ),
      };
      const archivedVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.archived,
        updatedAt: new Date(),
      };
      const updatedPurpose = replacePurposeVersion(
        purposeWithoutWaitingForApproval,
        archivedVersion
      );

      const eventToCreate = toCreateEventPurposeArchived({
        purpose: updatedPurpose,
        purposeVersionId: archivedVersion.id,
        version: purpose.metadata.version,
        correlationId,
      });

      const event = await repository.createEvent(eventToCreate);
      return {
        data: archivedVersion,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async internalArchivePurposeVersionAfterDelegationRevocation(
      {
        purposeId,
        versionId,
        delegationId,
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
        delegationId: DelegationId;
      },
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Archiving Version ${versionId} in Purpose ${purposeId} due to revocation of delegation ${delegationId}`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isArchivable(purposeVersion)) {
        throw notValidVersionState(versionId, purposeVersion.state);
      }

      if (
        !purpose.data.delegationId ||
        purpose.data.delegationId !== delegationId
      ) {
        throw purposeDelegationNotFound(purposeId, delegationId);
      }

      const purposeWithoutWaitingForApproval: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.state !== purposeVersionState.waitingForApproval
        ),
      };
      const archivedVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.archived,
        updatedAt: new Date(),
      };
      const updatedPurpose = replacePurposeVersion(
        purposeWithoutWaitingForApproval,
        archivedVersion
      );

      await repository.createEvent(
        toCreateEventPurposeVersionArchivedByRevokedDelegation({
          purpose: updatedPurpose,
          purposeVersionId: archivedVersion.id,
          delegationId,
          version: purpose.metadata.version,
          correlationId,
        })
      );
    },
    async suspendPurposeVersion(
      {
        purposeId,
        versionId,
        delegationId,
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
        delegationId: DelegationId | undefined;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeVersion>> {
      logger.info(
        `Suspending Version ${versionId} in Purpose ${purposeId}${
          delegationId ? ` with delegation ${delegationId}` : ""
        }`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isSuspendable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const suspender = await getOrganizationRole({
        purpose: purpose.data,
        producerId: eservice.producerId,
        delegationId,
        readModelService,
        authData,
      });

      const suspendedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.suspended,
        suspendedAt: new Date(),
        updatedAt: new Date(),
      };

      const eventToCreate = match(suspender)
        .with(ownership.CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByConsumer: true,
          };
          return toCreateEventPurposeSuspendedByConsumer({
            purpose: updatedPurpose,
            purposeVersionId: versionId,
            version: purpose.metadata.version,
            correlationId,
          });
        })
        .with(ownership.PRODUCER, ownership.SELF_CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByProducer: true,
          };
          return toCreateEventPurposeSuspendedByProducer({
            purpose: updatedPurpose,
            purposeVersionId: versionId,
            version: purpose.metadata.version,
            correlationId,
          });
        })
        .exhaustive();

      const createdEvent = await repository.createEvent(eventToCreate);
      return {
        data: suspendedPurposeVersion,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async getPurposes(
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number },
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<Purpose>> {
      logger.info(
        `Getting Purposes with filters: ${JSON.stringify(
          filters
        )}, limit = ${limit}, offset = ${offset}`
      );

      const { clientId, ...otherFilters } = filters;

      const effectivePurposesIds = await (async (): Promise<PurposeId[]> => {
        if (!clientId) {
          return [];
        }
        const client = await readModelService.getClientById(clientId);

        // Client purposes are visible only to the client owner (i.e., the client consumerId)
        if (authData.organizationId !== client?.data.consumerId) {
          return [];
        }
        return client?.data.purposes ?? [];
      })();

      // Permissions are checked in the readModelService
      return await readModelService.getPurposes(
        authData.organizationId,
        {
          ...otherFilters,
          purposesIds: effectivePurposesIds,
        },
        {
          offset,
          limit,
        }
      );
    },
    async createPurposeVersion(
      purposeId: PurposeId,
      seed: purposeApi.PurposeVersionSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<{
        purpose: Purpose;
        createdVersionId: PurposeVersionId;
      }>
    > {
      logger.info(`Creating Version for Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      if (purposeIsArchived(purpose.data)) {
        throw purposeCannotBeUpdated(purposeId);
      }

      assertRequesterCanActAsConsumer(
        purpose.data,
        authData,
        await retrievePurposeDelegation(purpose.data, readModelService)
      );

      const previousVersion = [
        ...purpose.data.versions.filter(
          (v) =>
            v.state === purposeVersionState.active ||
            v.state === purposeVersionState.suspended
        ),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const previousDailyCalls = previousVersion?.dailyCalls || 0;

      if (previousDailyCalls === seed.dailyCalls) {
        throw unchangedDailyCalls(purpose.data.id);
      }

      const conflictVersion = purpose.data.versions.find(
        (v) =>
          v.state === purposeVersionState.draft ||
          v.state === purposeVersionState.waitingForApproval
      );

      if (conflictVersion !== undefined) {
        throw purposeVersionStateConflict(
          purposeId,
          conflictVersion.id,
          conflictVersion.state
        );
      }

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      // isOverQuota doesn't include dailyCalls of suspended versions, so we don't have to calculate the delta. The delta is needed for active versions because those would be counted again inside isOverQuota
      const deltaDailyCalls =
        previousVersion.state === purposeVersionState.suspended
          ? seed.dailyCalls
          : seed.dailyCalls - previousDailyCalls;

      /**
       * If, with the given daily calls, the purpose goes in over quota,
       * we will create a new version in waiting for approval state
       */
      if (
        await isOverQuota(
          eservice,
          purpose.data,
          deltaDailyCalls,
          readModelService
        )
      ) {
        const newPurposeVersion: PurposeVersion = {
          id: generateId<PurposeVersionId>(),
          createdAt: new Date(),
          state: purposeVersionState.waitingForApproval,
          dailyCalls: seed.dailyCalls,
        };

        const updatedPurpose = {
          ...purpose.data,
          versions: [...purpose.data.versions, newPurposeVersion],
          updatedAt: new Date(),
        };

        const event = await repository.createEvent(
          toCreateEventNewPurposeVersionWaitingForApproval({
            purpose: updatedPurpose,
            versionId: newPurposeVersion.id,
            version: purpose.metadata.version,
            correlationId,
          })
        );

        return {
          data: {
            purpose: updatedPurpose,
            createdVersionId: newPurposeVersion.id,
          },
          metadata: { version: event.newVersion },
        };
      }

      /**
       * If the purpose is not over quota, we will create a new version directly in active state and
       * also generate the new risk analysis document
       */

      const stamps: PurposeVersionStamps = {
        creation: {
          who: authData.userId,
          when: new Date(),
        },
      };

      const newPurposeVersion: PurposeVersion = {
        id: generateId(),
        state: purposeVersionState.active,
        dailyCalls: seed.dailyCalls,
        firstActivationAt: new Date(),
        createdAt: new Date(),
        stamps,
      };

      const oldVersions = archiveActiveAndSuspendedPurposeVersions(
        purpose.data.versions
      );

      const updatedPurpose = {
        ...purpose.data,
        versions: [...oldVersions, newPurposeVersion],
        updatedAt: new Date(),
      };

      const event = await repository.createEvent(
        toCreateEventNewPurposeVersionActivated({
          purpose: updatedPurpose,
          versionId: newPurposeVersion.id,
          version: purpose.metadata.version,
          correlationId,
        })
      );

      return {
        data: {
          purpose: updatedPurpose,
          createdVersionId: newPurposeVersion.id,
        },
        metadata: { version: event.newVersion },
      };
    },
    async activatePurposeVersion(
      {
        purposeId,
        versionId,
        delegationId,
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
        delegationId: DelegationId | undefined;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<PurposeVersion>> {
      logger.info(
        `Activating Version ${versionId} in Purpose ${purposeId}${
          delegationId ? ` with delegation ${delegationId}` : ""
        }`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      if (purpose.data.purposeTemplateId) {
        await retrievePublishedPurposeTemplate(
          purpose.data.purposeTemplateId,
          readModelService
        );
      }

      if (purposeVersion.state === purposeVersionState.draft) {
        const riskAnalysisForm = purpose.data.riskAnalysisForm;

        if (!riskAnalysisForm) {
          throw missingRiskAnalysis(purposeId);
        }
        // the validation for receive mode is redundant because the same one has been already performed when the risk analysis has been added to the eservice
        if (eservice.mode === eserviceMode.deliver) {
          const tenantKind = await retrieveTenantKind(
            purpose.data.consumerId,
            readModelService
          );

          validateRiskAnalysisOrThrow({
            riskAnalysisForm:
              riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
            schemaOnlyValidation: false,
            fallbackTenantKind: tenantKind,
            dateForExpirationValidation: new Date(),
            personalDataInEService: eservice.personalData,
          });
        }
      }

      if (isFeatureFlagEnabled(config, "featureFlagNewOperators")) {
        if (
          purpose.data.reviewerWorkflow &&
          purpose.data.reviewerWorkflow.signingState !==
            riskAnalysisSigningState.signed
        ) {
          throw reviewerWorkflowNotInSignedState(purposeId);
        }
      }

      const purposeOwnership = await getOrganizationRole({
        purpose: purpose.data,
        producerId: eservice.producerId,
        delegationId,
        readModelService,
        authData,
      });

      const { event, updatedPurposeVersion } = await match({
        state: purposeVersion.state,
        purposeOwnership,
      })
        .with(
          {
            state: purposeVersionState.draft,
            purposeOwnership: P.union(
              ownership.CONSUMER,
              ownership.SELF_CONSUMER
            ),
          },
          async () => {
            if (
              await isOverQuota(
                eservice,
                purpose.data,
                purposeVersion.dailyCalls,
                readModelService
              )
            ) {
              return changePurposeVersionToWaitForApprovalFromDraftLogic(
                purpose,
                purposeVersion,
                correlationId
              );
            }
            return await activatePurposeLogic({
              fromState: purposeVersionState.draft,
              purpose,
              purposeVersion,
              correlationId,
              authData,
              eservice,
              readModelService,
            });
          }
        )
        .with(
          {
            state: purposeVersionState.draft,
            purposeOwnership: ownership.PRODUCER,
          },
          () => {
            throw tenantIsNotTheConsumer(authData.organizationId, delegationId);
          }
        )
        .with(
          {
            state: purposeVersionState.waitingForApproval,
            purposeOwnership: ownership.CONSUMER,
          },
          () => {
            throw tenantIsNotTheProducer(authData.organizationId, delegationId);
          }
        )
        .with(
          {
            state: purposeVersionState.waitingForApproval,
            purposeOwnership: P.union(
              ownership.PRODUCER,
              ownership.SELF_CONSUMER
            ),
          },
          async () =>
            await activatePurposeLogic({
              fromState: purposeVersionState.waitingForApproval,
              purpose,
              purposeVersion,
              correlationId,
              authData,
              eservice,
              readModelService,
            })
        )
        .with(
          {
            state: purposeVersionState.suspended,
            purposeOwnership: ownership.CONSUMER,
          },
          () =>
            purpose.data.suspendedByConsumer &&
            purpose.data.suspendedByProducer,
          () =>
            activatePurposeVersionFromSuspendedLogic(
              purpose,
              purposeVersion,
              purposeOwnership,
              correlationId
            )
        )
        .with(
          {
            state: purposeVersionState.suspended,
            purposeOwnership: ownership.CONSUMER,
          },
          () => purpose.data.suspendedByConsumer,
          async () => {
            if (
              await isOverQuota(
                eservice,
                purpose.data,
                purposeVersion.dailyCalls,
                readModelService
              )
            ) {
              return activatePurposeVersionFromOverQuotaSuspendedLogic(
                purpose,
                purposeVersion,
                correlationId
              );
            }
            return activatePurposeVersionFromSuspendedLogic(
              purpose,
              purposeVersion,
              purposeOwnership,
              correlationId
            );
          }
        )
        .with(
          {
            state: purposeVersionState.suspended,
            purposeOwnership: ownership.SELF_CONSUMER,
          },
          async () => {
            if (
              await isOverQuota(
                eservice,
                purpose.data,
                purposeVersion.dailyCalls,
                readModelService
              )
            ) {
              return activatePurposeVersionFromOverQuotaSuspendedLogic(
                purpose,
                purposeVersion,
                correlationId
              );
            }
            return activatePurposeVersionFromSuspendedLogic(
              purpose,
              purposeVersion,
              purposeOwnership,
              correlationId
            );
          }
        )
        .with(
          {
            state: purposeVersionState.suspended,
            purposeOwnership: ownership.PRODUCER,
          },
          () =>
            activatePurposeVersionFromSuspendedLogic(
              purpose,
              purposeVersion,
              purposeOwnership,
              correlationId
            )
        )
        .with(
          {
            state: P.union(
              purposeVersionState.archived,
              purposeVersionState.active,
              purposeVersionState.rejected,
              purposeVersionState.suspended
            ),
            purposeOwnership: P.union(
              ownership.CONSUMER,
              ownership.SELF_CONSUMER,
              ownership.PRODUCER
            ),
          },
          () => {
            throw tenantNotAllowed(authData.organizationId);
          }
        )
        .exhaustive();

      const createdEvent = await repository.createEvent(event);

      return {
        data: updatedPurposeVersion,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async createPurpose(
      purposeSeed: purposeApi.PurposeSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(
        `Creating Purpose for EService ${purposeSeed.eserviceId} and Consumer ${purposeSeed.consumerId}`
      );
      const eserviceId = unsafeBrandId<EServiceId>(purposeSeed.eserviceId);
      const consumerId = unsafeBrandId<TenantId>(purposeSeed.consumerId);

      assertConsistentFreeOfCharge(
        purposeSeed.isFreeOfCharge,
        purposeSeed.freeOfChargeReason
      );

      const delegationId = await verifyRequesterIsConsumerOrDelegateConsumer(
        consumerId,
        eserviceId,
        authData,
        readModelService
      );

      const createdAt = new Date();

      const eservice = await retrieveEService(eserviceId, readModelService);

      const tenantKindToWriteInRA = await retrieveTenantKind(
        unsafeBrandId<TenantId>(purposeSeed.consumerId),
        readModelService
      );

      const riskAnalysisFormToValidate: RiskAnalysisFormToValidate | undefined =
        purposeSeed.riskAnalysisForm
          ? {
              ...purposeSeed.riskAnalysisForm,
              tenantKind: tenantKindToWriteInRA,
            }
          : undefined;

      const validatedFormSeed = validateAndTransformRiskAnalysis(
        riskAnalysisFormToValidate,
        false,
        tenantKindToWriteInRA,
        createdAt,
        eservice.personalData
      );

      await retrieveActiveAgreement(eserviceId, consumerId, readModelService);

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId,
        title: purposeSeed.title,
      });

      const purpose: Purpose = {
        id: generateId(),
        title: purposeSeed.title,
        description: purposeSeed.description,
        createdAt,
        eserviceId,
        consumerId,
        delegationId,
        versions: [
          {
            id: generateId(),
            state: purposeVersionState.draft,
            dailyCalls: purposeSeed.dailyCalls,
            createdAt: new Date(),
          },
        ],
        riskAnalysisForm: validatedFormSeed,
        isFreeOfCharge: purposeSeed.isFreeOfCharge,
        freeOfChargeReason: purposeSeed.freeOfChargeReason,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeAdded(purpose, correlationId)
      );
      return {
        data: purpose,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async createReversePurpose(
      seed: purposeApi.ReversePurposeSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(
        `Creating Purpose for EService ${seed.eserviceId}, Consumer ${seed.consumerId}`
      );
      const riskAnalysisId: RiskAnalysisId = unsafeBrandId(seed.riskAnalysisId);
      const eserviceId: EServiceId = unsafeBrandId(seed.eserviceId);
      const consumerId: TenantId = unsafeBrandId(seed.consumerId);

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertEserviceMode(eservice, eserviceMode.receive);

      const riskAnalysis = retrieveRiskAnalysis(riskAnalysisId, eservice);

      assertConsistentFreeOfCharge(
        seed.isFreeOfCharge,
        seed.freeOfChargeReason
      );

      const delegationId = await verifyRequesterIsConsumerOrDelegateConsumer(
        consumerId,
        eserviceId,
        authData,
        readModelService
      );

      await retrieveActiveAgreement(eserviceId, consumerId, readModelService);

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId,
        title: seed.title,
      });

      const createdAt = new Date();

      const newVersion: PurposeVersion = {
        id: generateId(),
        createdAt,
        state: purposeVersionState.draft,
        dailyCalls: seed.dailyCalls,
      };

      const purpose: Purpose = {
        title: seed.title,
        id: generateId(),
        createdAt: new Date(),
        eserviceId,
        consumerId,
        delegationId,
        description: seed.description,
        versions: [newVersion],
        isFreeOfCharge: seed.isFreeOfCharge,
        freeOfChargeReason: seed.freeOfChargeReason,
        riskAnalysisForm: {
          ...riskAnalysis.riskAnalysisForm,
          riskAnalysisId,
        },
      };

      const event = await repository.createEvent(
        toCreateEventPurposeAdded(purpose, correlationId)
      );

      return {
        data: purpose,
        metadata: { version: event.newVersion },
      };
    },
    async clonePurpose({
      purposeId,
      seed,
      ctx: { correlationId, authData, logger },
    }: {
      purposeId: PurposeId;
      seed: purposeApi.PurposeCloneSeed;
      ctx: WithLogger<AppContext<UIAuthData>>;
    }): Promise<{ purpose: Purpose }> {
      const organizationId = authData.organizationId;

      logger.info(`Cloning Purpose ${purposeId}`);

      const purposeToClone = await retrievePurpose(purposeId, readModelService);

      assertRequesterCanActAsConsumer(
        purposeToClone.data,
        authData,
        await retrievePurposeDelegation(purposeToClone.data, readModelService)
      );

      if (!isClonable(purposeToClone.data)) {
        throw purposeCannotBeCloned(purposeId);
      }

      const versionToClone = getVersionToClone(purposeToClone.data);

      const newPurposeVersion: PurposeVersion = {
        id: generateId(),
        createdAt: new Date(),
        state: purposeVersionState.draft,
        dailyCalls: versionToClone.dailyCalls,
      };

      const riskAnalysisFormToClone = purposeToClone.data.riskAnalysisForm;

      const clonedRiskAnalysisForm: PurposeRiskAnalysisForm | undefined =
        riskAnalysisFormToClone
          ? {
              id: generateId(),
              version: riskAnalysisFormToClone.version,
              riskAnalysisId: riskAnalysisFormToClone.riskAnalysisId,
              singleAnswers: riskAnalysisFormToClone.singleAnswers.map(
                (answer) => ({
                  ...answer,
                  id: generateId(),
                })
              ),
              multiAnswers: riskAnalysisFormToClone.multiAnswers.map(
                (answer) => ({
                  ...answer,
                  id: generateId(),
                })
              ),
            }
          : undefined;

      const currentDate = new Date();
      const title = purposeToClone.data.title;
      const suffix = ` - clone - ${formatDateddMMyyyyHHmmss(currentDate)}`;
      const dots = "...";
      const maxTitleLength = 60; // same value as in the api spec (PurposeSeed)
      const prefixLengthAllowance =
        maxTitleLength - suffix.length - dots.length;
      const clonedPurposeTitle =
        title.length + suffix.length <= maxTitleLength
          ? `${title}${suffix}`
          : `${title.slice(0, prefixLengthAllowance)}${dots}${suffix}`;

      const eserviceId = unsafeBrandId<EServiceId>(seed.eserviceId);
      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId: organizationId,
        title: clonedPurposeTitle,
      });

      const clonedPurpose: Purpose = {
        title: clonedPurposeTitle,
        id: generateId(),
        createdAt: currentDate,
        eserviceId: unsafeBrandId(seed.eserviceId),
        consumerId: organizationId,
        description: purposeToClone.data.description,
        versions: [newPurposeVersion],
        isFreeOfCharge: purposeToClone.data.isFreeOfCharge,
        freeOfChargeReason: purposeToClone.data.freeOfChargeReason,
        riskAnalysisForm: clonedRiskAnalysisForm,
        delegationId: purposeToClone.data.delegationId,
      };

      const event = toCreateEventPurposeCloned({
        purpose: clonedPurpose,
        sourcePurposeId: purposeToClone.data.id,
        sourceVersionId: versionToClone.id,
        correlationId,
      });
      await repository.createEvent(event);
      return {
        purpose: clonedPurpose,
      };
    },
    async retrieveRiskAnalysisConfigurationByVersion({
      eserviceId,
      riskAnalysisVersion,
      ctx: { logger, authData },
    }: {
      eserviceId: EServiceId;
      riskAnalysisVersion: string;
      ctx: WithLogger<AppContext<UIAuthData>>;
    }): Promise<RiskAnalysisFormRules> {
      logger.info(
        `Retrieve version ${riskAnalysisVersion} of risk analysis configuration`
      );
      // No permission checks needed for this route, as the configuration
      // is the same for all tenants of the same kind and is not specific to a purpose.

      const eservice = await retrieveEService(eserviceId, readModelService);
      const tenantKind = await retrieveKindOfInvolvedTenantByEServiceMode(
        eservice,
        authData.organizationId,
        readModelService
      );

      const riskAnalysisFormConfig = getFormRulesByVersion(
        tenantKind,
        riskAnalysisVersion
      );

      if (!riskAnalysisFormConfig) {
        throw riskAnalysisConfigVersionNotFound(
          riskAnalysisVersion,
          tenantKind
        );
      }

      return riskAnalysisFormConfig;
    },
    async retrieveLatestRiskAnalysisConfiguration({
      tenantKind,
      ctx: { logger, authData },
    }: {
      tenantKind: TenantKind | undefined;
      ctx: WithLogger<AppContext<UIAuthData>>;
    }): Promise<RiskAnalysisFormRules> {
      logger.info(`Retrieve latest risk analysis configuration`);
      // No permission checks needed for this route, as the configuration
      // is the same for all tenants of the same kind and is not specific to a purpose.

      const kind =
        tenantKind ||
        (await retrieveTenantKind(authData.organizationId, readModelService));

      const riskAnalysisFormConfig = getLatestVersionFormRules(kind);
      if (!riskAnalysisFormConfig) {
        throw riskAnalysisConfigLatestVersionNotFound(kind);
      }

      return riskAnalysisFormConfig;
    },
    async createPurposeFromTemplate(
      purposeTemplateId: PurposeTemplateId,
      body: purposeApi.PurposeFromTemplateSeed,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(`Creating Purpose from Template ${purposeTemplateId}`);

      const consumerId = unsafeBrandId<TenantId>(body.consumerId);
      const eserviceId = unsafeBrandId<EServiceId>(body.eserviceId);

      const delegationId = await verifyRequesterIsConsumerOrDelegateConsumer(
        consumerId,
        eserviceId,
        authData,
        readModelService
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertEserviceMode(eservice, eserviceMode.deliver);

      const tenantKind = await retrieveTenantKind(consumerId, readModelService);

      await retrieveActiveAgreement(eserviceId, consumerId, readModelService);

      const purposeTemplate = await retrievePublishedPurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      assertValidPurposeTenantKind(
        tenantKind,
        purposeTemplate.targetTenantKind
      );

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId,
        title: body.title,
      });

      const eservicePersonalData = eservice.personalData;
      assertPersonalDataCompliant(
        eservicePersonalData,
        purposeTemplate.handlesPersonalData
      );

      const createdAt = new Date();

      const formToValidate: RiskAnalysisFormToValidate | undefined =
        body.riskAnalysisForm
          ? {
              ...body.riskAnalysisForm,
              tenantKind,
            }
          : undefined;

      const validatedFormSeed = validateRiskAnalysisAgainstTemplateOrThrow(
        purposeTemplate,
        formToValidate,
        tenantKind,
        createdAt,
        eservicePersonalData
      );

      const purpose: Purpose = {
        id: generateId(),
        title: body.title,
        description: purposeTemplate.purposeDescription,
        eserviceId,
        consumerId,
        delegationId,
        riskAnalysisForm: validatedFormSeed,
        isFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
        freeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason
          ? purposeTemplate.purposeFreeOfChargeReason
          : undefined,
        versions: [
          {
            id: generateId(),
            state: purposeVersionState.draft,
            dailyCalls: body.dailyCalls,
            createdAt,
          },
        ],
        createdAt,
        purposeTemplateId,
      };

      const event = await repository.createEvent(
        toCreateEventPurposeAdded(purpose, correlationId)
      );

      return {
        data: purpose,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async internalAddUnsignedRiskAnalysisDocumentMetadata(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      riskAnalysisDocument: PurposeVersionDocument,
      { logger, correlationId }: WithLogger<AppContext<AuthData>>
    ): Promise<WithMetadata<PurposeVersion>> {
      logger.info(
        `Adding risk analysis document for purpose ${purposeId}, version ${versionId}, document id ${riskAnalysisDocument.id}`
      );
      const purposeRetrieved = await retrievePurpose(
        purposeId,
        readModelService
      );

      const versionRetrieved = retrievePurposeVersion(
        versionId,
        purposeRetrieved
      );

      const updatedVersion: PurposeVersion = {
        ...versionRetrieved,
        riskAnalysis: riskAnalysisDocument,
      };

      const updatedPurpose = replacePurposeVersion(
        purposeRetrieved.data,
        updatedVersion
      );

      const event = await repository.createEvent(
        toCreateEventRiskAnalysisDocumentGenerated({
          purpose: updatedPurpose,
          version: purposeRetrieved.metadata.version,
          versionId,
          correlationId,
        })
      );

      return {
        data: updatedVersion,
        metadata: { version: event.newVersion },
      };
    },
    async internalAddSignedRiskAnalysisDocumentMetadata(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      signedRiskAnalysis: PurposeVersionSignedDocument,
      { logger, correlationId }: WithLogger<AppContext<AuthData>>
    ): Promise<WithMetadata<PurposeVersion>> {
      logger.info(
        `Adding signed risk analysis document for purpose ${purposeId}, version ${versionId}`
      );
      const purposeRetrieved = await retrievePurpose(
        purposeId,
        readModelService
      );

      const versionRetrieved = retrievePurposeVersion(
        versionId,
        purposeRetrieved
      );

      const updatedVersion: PurposeVersion = {
        ...versionRetrieved,
        signedContract: signedRiskAnalysis,
      };

      const updatedPurpose = replacePurposeVersion(
        purposeRetrieved.data,
        updatedVersion
      );

      const event = await repository.createEvent(
        toCreateEventRiskAnalysisSignedDocumentGenerated({
          purpose: updatedPurpose,
          version: purposeRetrieved.metadata.version,
          versionId,
          correlationId,
        })
      );
      return {
        data: updatedVersion,
        metadata: { version: event.newVersion },
      };
    },
    async patchUpdatePurposeFromTemplate(
      purposeTemplateId: PurposeTemplateId,
      purposeId: PurposeId,
      purposeUpdateContent: purposeApi.PatchPurposeUpdateFromTemplateContent,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Purpose>> {
      logger.info(
        `Partial updating draft Purpose ${purposeId} created by Purpose template ${purposeTemplateId}`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const lastDraftVersion = retrieveDraftPurposeVersion(purpose.data);
      assertPurposeIsDraft(purpose.data);

      assertRequesterCanActAsConsumer(
        purpose.data,
        authData,
        await retrievePurposeDelegation(purpose.data, readModelService)
      );

      const purposeTemplate = await retrievePublishedPurposeTemplate(
        purposeTemplateId,
        readModelService
      );

      if (
        purposeUpdateContent.title &&
        purposeUpdateContent.title?.toLocaleLowerCase() !==
          purpose.data.title.toLocaleLowerCase()
      ) {
        await assertPurposeTitleIsNotDuplicated({
          readModelService,
          eserviceId: purpose.data.eserviceId,
          consumerId: purpose.data.consumerId,
          title: purposeUpdateContent.title,
        });
      }

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const tenantKind = await retrieveKindOfInvolvedTenantByEServiceMode(
        eservice,
        purpose.data.consumerId,
        readModelService
      );

      const formToValidate: RiskAnalysisFormToValidate | undefined =
        purposeUpdateContent.riskAnalysisForm
          ? {
              ...purposeUpdateContent.riskAnalysisForm,
              tenantKind,
            }
          : undefined;

      const updatedRiskAnalysisForm = formToValidate
        ? validateRiskAnalysisAgainstTemplateOrThrow(
            purposeTemplate,
            formToValidate,
            purposeTemplate.targetTenantKind,
            purpose.data.createdAt,
            eservice.personalData
          )
        : undefined;

      const updatedVersions = purposeUpdateContent.dailyCalls
        ? replacePurposeVersion(purpose.data, {
            ...lastDraftVersion,
            dailyCalls: purposeUpdateContent.dailyCalls,
            updatedAt: new Date(),
          }).versions
        : purpose.data.versions;

      const updatedPurpose: Purpose = {
        ...purpose.data,
        title: purposeUpdateContent.title ?? purpose.data.title,
        versions: updatedVersions,
        riskAnalysisForm: updatedRiskAnalysisForm
          ? updatedRiskAnalysisForm
          : purpose.data.riskAnalysisForm,
        updatedAt: new Date(),
      };

      const event = toCreateEventDraftPurposeUpdated({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        correlationId,
      });
      const createdEvent = await repository.createEvent(event);

      return {
        data: updatedPurpose,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async getRiskAnalysisSignedDocument({
      purposeId,
      versionId,
      documentId,
      ctx: { authData, logger },
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      documentId: PurposeVersionDocumentId;
      ctx: WithLogger<AppContext<UIAuthData>>;
    }): Promise<PurposeVersionDocument> {
      logger.info(
        `Retrieving Risk Analysis signed document ${documentId} in version ${versionId} of Purpose ${purposeId}`
      );

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      await assertRequesterCanRetrievePurpose(
        purpose.data,
        eservice,
        authData,
        readModelService
      );

      const version = retrievePurposeVersion(versionId, purpose);

      return retrievePurposeVersionSignedDocument(
        purposeId,
        version,
        documentId
      );
    },
    async getRemainingDailyCalls({
      purposeId,
      ctx: { authData, logger },
    }: {
      purposeId: PurposeId;
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>;
    }): Promise<purposeApi.RemainingDailyCallsResponse> {
      logger.info(`Retrieving remaining daily calls for Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertRequesterCanActAsConsumer(
        purpose.data,
        authData,
        await retrievePurposeDelegation(purpose.data, readModelService)
      );

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const quotas = await getUpdatedQuotas(
        eservice,
        purpose.data.consumerId,
        readModelService
      );
      const remainingDailyCallsPerConsumer = Math.max(
        0,
        quotas.maxDailyCallsPerConsumer - quotas.currentConsumerCalls
      );
      const remainingDailyCallsTotal = Math.max(
        0,
        quotas.maxDailyCallsTotal - quotas.currentTotalCalls
      );
      return {
        remainingDailyCallsPerConsumer,
        remainingDailyCallsTotal,
      };
    },
  };
}

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

const replacePurposeVersion = (
  purpose: Purpose,
  newVersion: PurposeVersion
): Purpose => {
  const updatedVersions = purpose.versions.map((v: PurposeVersion) =>
    v.id === newVersion.id ? newVersion : v
  );

  return {
    ...purpose,
    versions: updatedVersions,
    updatedAt: newVersion.updatedAt,
  };
};

const retrieveKindOfInvolvedTenantByEServiceMode = async (
  eservice: EService,
  consumerId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<TenantKind> => {
  if (eservice.mode === eserviceMode.deliver) {
    return retrieveTenantKind(consumerId, readModelService);
  } else {
    return retrieveTenantKind(eservice.producerId, readModelService);
  }
};

const archiveActiveAndSuspendedPurposeVersions = (
  versions: PurposeVersion[]
): PurposeVersion[] =>
  versions.map((v) =>
    match(v.state)
      .with(purposeVersionState.active, purposeVersionState.suspended, () => ({
        ...v,
        state: purposeVersionState.archived,
        updatedAt: new Date(),
      }))
      .otherwise(() => v)
  );

export type UpdatePurposeReturn = WithMetadata<{
  purpose: Purpose;
}>;
const performUpdatePurpose = async (
  purposeId: PurposeId,
  modeAndUpdateContent:
    | {
        mode: "Deliver";
        updateContent:
          | purposeApi.PurposeUpdateContent
          | purposeApi.PatchPurposeUpdateContent;
      }
    | {
        mode: "Receive";
        updateContent:
          | purposeApi.ReversePurposeUpdateContent
          | purposeApi.PatchReversePurposeUpdateContent;
      },
  authData: UIAuthData | M2MAdminAuthData,
  readModelService: ReadModelServiceSQL,
  correlationId: CorrelationId,
  repository: ReturnType<typeof eventRepository<PurposeEvent>>
  // eslint-disable-next-line max-params, sonarjs/cognitive-complexity
): Promise<UpdatePurposeReturn> => {
  const purpose = await retrievePurpose(purposeId, readModelService);
  assertRequesterCanActAsConsumer(
    purpose.data,
    authData,
    await retrievePurposeDelegation(purpose.data, readModelService)
  );

  assertPurposeIsDraft(purpose.data);
  assertPurposeIsNotFromTemplate(purpose.data);

  const {
    title,
    description,
    isFreeOfCharge,
    freeOfChargeReason,
    dailyCalls,
    riskAnalysisForm,
    ...rest
  } = match(modeAndUpdateContent)
    .with({ mode: eserviceMode.deliver }, ({ updateContent }) => updateContent)
    .with({ mode: eserviceMode.receive }, ({ updateContent }) => ({
      ...updateContent,
      riskAnalysisForm: undefined, // To make the destructuring work also for receive mode
    }))
    .exhaustive();

  void (rest satisfies Record<string, never>);
  // ^ To make sure we extract all the updated fields, even optional ones

  const { mode } = modeAndUpdateContent;

  if (title && title !== purpose.data.title) {
    await assertPurposeTitleIsNotDuplicated({
      readModelService,
      eserviceId: purpose.data.eserviceId,
      consumerId: purpose.data.consumerId,
      title,
    });
  }

  const eservice = await retrieveEService(
    purpose.data.eserviceId,
    readModelService
  );
  assertEserviceMode(eservice, mode);

  const tenantKind = await retrieveKindOfInvolvedTenantByEServiceMode(
    eservice,
    purpose.data.consumerId,
    readModelService
  );

  const riskAnalysisFormToValidate: RiskAnalysisFormToValidate | undefined =
    riskAnalysisForm
      ? {
          ...riskAnalysisForm,
          tenantKind,
        }
      : undefined;

  const newRiskAnalysis: PurposeRiskAnalysisForm | undefined =
    mode === eserviceMode.deliver && riskAnalysisForm
      ? (() => {
          const validated = validateAndTransformRiskAnalysis(
            riskAnalysisFormToValidate,
            true,
            tenantKind,
            new Date(),
            eservice.personalData
          );
          return validated;
        })()
      : purpose.data.riskAnalysisForm;

  const updatedPurposeIsFreeOfCharge =
    isFreeOfCharge ?? purpose.data.isFreeOfCharge;

  function updateFreeOfChargeReason(): string | undefined {
    function normalizeFreeOfChargeReason(
      freeOfChargeReason: string | null | undefined
    ): string | null | undefined {
      if (typeof freeOfChargeReason === "string") {
        const trimmedFreeOfChargeReason = freeOfChargeReason.trim();
        return trimmedFreeOfChargeReason.length > 0
          ? trimmedFreeOfChargeReason
          : null;
      }

      return freeOfChargeReason;
    }
    const normalizedSeedFreeOfChargeReason =
      normalizeFreeOfChargeReason(freeOfChargeReason);

    // Return the seed freeOfChargeReason if defined and not empty
    if (
      normalizedSeedFreeOfChargeReason !== undefined &&
      normalizedSeedFreeOfChargeReason !== null
    ) {
      return normalizedSeedFreeOfChargeReason;
    }

    // Return undefined if the updated isFreeOfCharge is false or the seed freeOfChargeReason is explicitly set to null or empty string.
    // A purpose should only have a freeOfChargeReason when isFreeOfCharge is true.
    if (
      !updatedPurposeIsFreeOfCharge ||
      normalizedSeedFreeOfChargeReason === null
    ) {
      return undefined;
    }

    // Fallback to the existing freeOfChargeReason in the purpose
    return purpose.data.freeOfChargeReason;
  }

  const updatedPurpose: Purpose = {
    ...purpose.data,
    title: title ?? purpose.data.title,
    description: description ?? purpose.data.description,
    isFreeOfCharge: updatedPurposeIsFreeOfCharge,
    freeOfChargeReason: updateFreeOfChargeReason(),
    versions: [
      {
        ...purpose.data.versions[0],
        dailyCalls: dailyCalls ?? purpose.data.versions[0].dailyCalls,
        updatedAt: new Date(),
      },
    ],
    updatedAt: new Date(),
    riskAnalysisForm: newRiskAnalysis,
  };

  assertConsistentFreeOfCharge(
    updatedPurpose.isFreeOfCharge,
    updatedPurpose.freeOfChargeReason
  );

  const event = toCreateEventDraftPurposeUpdated({
    purpose: updatedPurpose,
    version: purpose.metadata.version,
    correlationId,
  });
  const createdEvent = await repository.createEvent(event);

  return {
    data: {
      purpose: updatedPurpose,
    },
    metadata: { version: createdEvent.newVersion },
  };
};

const getVersionToClone = (purposeToClone: Purpose): PurposeVersion => {
  const nonWaitingVersions = purposeToClone.versions.filter(
    (v) => v.state !== purposeVersionState.waitingForApproval
  );

  const versionsToSearch =
    nonWaitingVersions.length > 0
      ? nonWaitingVersions
      : purposeToClone.versions;

  const sortedVersions = [...versionsToSearch].sort(
    (v1, v2) => v2.createdAt.getTime() - v1.createdAt.getTime()
  );

  return sortedVersions[0];
};

function changePurposeVersionToWaitForApprovalFromDraftLogic(
  purpose: WithMetadata<Purpose>,
  purposeVersion: PurposeVersion,
  correlationId: CorrelationId
): {
  event: CreateEvent<PurposeEvent>;
  updatedPurposeVersion: PurposeVersion;
} {
  const updatedPurposeVersion: PurposeVersion = {
    ...purposeVersion,
    state: purposeVersionState.waitingForApproval,
    updatedAt: new Date(),
  };

  const updatedPurpose: Purpose = replacePurposeVersion(
    purpose.data,
    updatedPurposeVersion
  );

  return {
    event: toCreateEventPurposeWaitingForApproval({
      purpose: updatedPurpose,
      version: purpose.metadata.version,
      correlationId,
    }),
    updatedPurposeVersion,
  };
}

function activatePurposeVersionFromOverQuotaSuspendedLogic(
  purpose: WithMetadata<Purpose>,
  purposeVersion: PurposeVersion,
  correlationId: CorrelationId
): {
  event: CreateEvent<PurposeEvent>;
  updatedPurposeVersion: PurposeVersion;
} {
  const newPurposeVersion: PurposeVersion = {
    createdAt: new Date(),
    state: purposeVersionState.waitingForApproval,
    id: generateId<PurposeVersionId>(),
    dailyCalls: purposeVersion.dailyCalls,
  };

  const oldVersions = purpose.data.versions.filter(
    (v) => v.state !== purposeVersionState.waitingForApproval
  );

  const updatedPurpose: Purpose = {
    ...purpose.data,
    versions: [...oldVersions, newPurposeVersion],
    updatedAt: new Date(),
  };

  return {
    event: toCreateEventPurposeVersionOverQuotaUnsuspended({
      purpose: updatedPurpose,
      versionId: newPurposeVersion.id,
      version: purpose.metadata.version,
      correlationId,
    }),
    updatedPurposeVersion: newPurposeVersion,
  };
}

async function activatePurposeLogic({
  fromState,
  purpose,
  purposeVersion,
  correlationId,
  authData,
  eservice,
  readModelService,
}: {
  fromState:
    | typeof purposeVersionState.draft
    | typeof purposeVersionState.waitingForApproval;
  purpose: WithMetadata<Purpose>;
  purposeVersion: PurposeVersion;
  correlationId: CorrelationId;
  authData: UIAuthData | M2MAdminAuthData;
  eservice: EService;
  readModelService: ReadModelServiceSQL;
}): Promise<{
  event: CreateEvent<PurposeEvent>;
  updatedPurposeVersion: PurposeVersion;
}> {
  if (isFeatureFlagEnabled(config, "featureFlagTenantKindInRiskAnalysis")) {
    const riskAnalysisForm = purpose.data.riskAnalysisForm;
    if (riskAnalysisForm) {
      const tenantKind = await retrieveKindOfInvolvedTenantByEServiceMode(
        eservice,
        purpose.data.consumerId,
        readModelService
      );
      assertRiskAnalysisTenantKindMatch({
        actualKind: riskAnalysisForm.tenantKind,
        currentTenantKind: tenantKind,
        riskAnalysisFormId: riskAnalysisForm.id,
      });
    }
  }

  // We generate the stamp in the transition draft -> active.
  // Instead, the transition waiting_for_approval -> active is performed by the producer,
  // so in this case the stamp doesn't have to be regenerated
  const stamps: PurposeVersionStamps | undefined = match(fromState)
    .with(purposeVersionState.draft, () => ({
      creation: { who: authData.userId, when: new Date() },
    }))
    .with(purposeVersionState.waitingForApproval, () => purposeVersion.stamps)
    .exhaustive();

  const updatedPurposeVersion: PurposeVersion = {
    ...purposeVersion,
    state: purposeVersionState.active,
    stamps,
    updatedAt: new Date(),
    firstActivationAt: new Date(),
  };

  const unsuspendedPurpose: Purpose =
    fromState === purposeVersionState.waitingForApproval
      ? {
          ...purpose.data,
          suspendedByConsumer: false,
          suspendedByProducer: false,
        }
      : purpose.data;
  const updatedPurpose: Purpose = replacePurposeVersion(
    {
      ...unsuspendedPurpose,
      versions: archiveActiveAndSuspendedPurposeVersions(purpose.data.versions),
    },
    updatedPurposeVersion
  );

  if (fromState === purposeVersionState.draft) {
    return {
      event: toCreateEventPurposeActivated({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        correlationId,
      }),
      updatedPurposeVersion,
    };
  } else {
    return {
      event: toCreateEventPurposeVersionActivated({
        purpose: updatedPurpose,
        versionId: updatedPurposeVersion.id,
        version: purpose.metadata.version,
        correlationId,
      }),
      updatedPurposeVersion,
    };
  }
}

function activatePurposeVersionFromSuspendedLogic(
  purpose: WithMetadata<Purpose>,
  purposeVersion: PurposeVersion,
  purposeOwnership: Ownership,
  correlationId: CorrelationId
): {
  event: CreateEvent<PurposeEvent>;
  updatedPurposeVersion: PurposeVersion;
} {
  const newState = match({
    suspendedByProducer: purpose.data.suspendedByProducer,
    suspendedByConsumer: purpose.data.suspendedByConsumer,
    purposeOwnership,
  })
    .with(
      {
        suspendedByConsumer: true,
        purposeOwnership: ownership.PRODUCER,
      },
      {
        suspendedByProducer: true,
        purposeOwnership: ownership.CONSUMER,
      },
      () => purposeVersionState.suspended
    )
    .with(
      {
        suspendedByConsumer: P.any,
        suspendedByProducer: P.any,
        purposeOwnership: P.union(
          ownership.SELF_CONSUMER,
          ownership.CONSUMER,
          ownership.PRODUCER
        ),
      },
      () => purposeVersionState.active
    )
    .exhaustive();

  const updatedPurposeVersion: PurposeVersion = {
    ...purposeVersion,
    updatedAt: new Date(),
    suspendedAt:
      newState !== purposeVersionState.suspended
        ? undefined
        : purposeVersion.suspendedAt,
    state: newState,
  };

  const updatedPurpose: Purpose = replacePurposeVersion(
    purpose.data,
    updatedPurposeVersion
  );

  return match(purposeOwnership)
    .with(P.union(ownership.PRODUCER, ownership.SELF_CONSUMER), () => ({
      event: toCreateEventPurposeVersionUnsuspenedByProducer({
        purpose: { ...updatedPurpose, suspendedByProducer: false },
        versionId: purposeVersion.id,
        version: purpose.metadata.version,
        correlationId,
      }),
      updatedPurposeVersion,
    }))
    .with(ownership.CONSUMER, () => ({
      event: toCreateEventPurposeVersionUnsuspenedByConsumer({
        purpose: { ...updatedPurpose, suspendedByConsumer: false },
        versionId: purposeVersion.id,
        version: purpose.metadata.version,
        correlationId,
      }),
      updatedPurposeVersion,
    }))
    .exhaustive();
}
