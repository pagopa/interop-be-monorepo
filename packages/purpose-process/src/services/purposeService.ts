/* eslint-disable sonarjs/no-identical-functions */
import {
  AppContext,
  CreateEvent,
  DB,
  FileManager,
  InternalAuthData,
  Logger,
  M2MAdminAuthData,
  M2MAuthData,
  PDFGenerator,
  RiskAnalysisFormRules,
  UIAuthData,
  WithLogger,
  eventRepository,
  formatDateddMMyyyyHHmmss,
  getFormRulesByVersion,
  getIpaCode,
  getLatestVersionFormRules,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  EService,
  EServiceId,
  TenantId,
  WithMetadata,
  Tenant,
  Purpose,
  PurposeId,
  TenantKind,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  PurposeVersionId,
  purposeEventToBinaryData,
  purposeVersionState,
  PurposeRiskAnalysisForm,
  PurposeEvent,
  eserviceMode,
  ListResult,
  unsafeBrandId,
  generateId,
  Agreement,
  RiskAnalysisId,
  RiskAnalysis,
  CorrelationId,
  Delegation,
  DelegationId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { P, match } from "ts-pattern";
import {
  agreementNotFound,
  eserviceNotFound,
  missingRiskAnalysis,
  eserviceRiskAnalysisNotFound,
  notValidVersionState,
  tenantIsNotTheConsumer,
  tenantIsNotTheProducer,
  purposeCannotBeDeleted,
  purposeCannotBeCloned,
  purposeNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  purposeVersionStateConflict,
  tenantNotFound,
  riskAnalysisConfigVersionNotFound,
  riskAnalysisConfigLatestVersionNotFound,
  tenantKindNotFound,
  unchangedDailyCalls,
  tenantNotAllowed,
  purposeDelegationNotFound,
  purposeCannotBeUpdated,
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
  toCreateEventPurposeVersionActivated,
  toCreateEventPurposeVersionArchivedByRevokedDelegation,
  toCreateEventPurposeVersionOverQuotaUnsuspended,
  toCreateEventPurposeVersionRejected,
  toCreateEventPurposeVersionUnsuspenedByConsumer,
  toCreateEventPurposeVersionUnsuspenedByProducer,
  toCreateEventPurposeWaitingForApproval,
  toCreateEventWaitingForApprovalPurposeDeleted,
  toCreateEventWaitingForApprovalPurposeVersionDeleted,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import {
  ownership,
  Ownership,
  PurposeDocumentEServiceInfo,
} from "../model/domain/models.js";
import { GetPurposesFilters, ReadModelService } from "./readModelService.js";
import {
  assertEserviceMode,
  assertConsistentFreeOfCharge,
  isRiskAnalysisFormValid,
  isDeletableVersion,
  purposeIsDraft,
  reverseValidateAndTransformRiskAnalysis,
  validateAndTransformRiskAnalysis,
  assertPurposeIsDraft,
  isRejectable,
  isDeletable,
  isArchivable,
  isSuspendable,
  validateRiskAnalysisOrThrow,
  assertPurposeTitleIsNotDuplicated,
  isOverQuota,
  assertRequesterCanActAsConsumer,
  assertRequesterCanActAsProducer,
  assertRequesterCanRetrievePurpose,
  verifyRequesterIsConsumerOrDelegateConsumer,
  isClonable,
  purposeIsArchived,
} from "./validators.js";
import { riskAnalysisDocumentBuilder } from "./riskAnalysisDocumentBuilder.js";

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelService
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

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
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
  readModelService: ReadModelService
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
  readModelService: ReadModelService
): Promise<TenantKind> {
  const tenant = await retrieveTenant(tenantId, readModelService);
  if (!tenant.kind) {
    throw tenantKindNotFound(tenant.id);
  }
  return tenant.kind;
}

export const retrievePurposeDelegation = async (
  purpose: Purpose,
  readModelService: ReadModelService
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager,
  pdfGenerator: PDFGenerator
) {
  const repository = eventRepository(dbInstance, purposeEventToBinaryData);

  return {
    async getPurposeById(
      purposeId: PurposeId,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<{ purpose: Purpose; isRiskAnalysisValid: boolean }>
    > {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const [eservice, tenantKind] = await Promise.all([
        retrieveEService(purpose.data.eserviceId, readModelService),
        retrieveTenantKind(authData.organizationId, readModelService),
      ]);

      await assertRequesterCanRetrievePurpose(
        purpose.data,
        eservice,
        authData,
        readModelService
      );

      const isRiskAnalysisValid = purposeIsDraft(purpose.data)
        ? isRiskAnalysisFormValid(
            purpose.data.riskAnalysisForm,
            false,
            tenantKind
          )
        : true;

      return {
        data: { purpose: purpose.data, isRiskAnalysisValid },
        metadata: purpose.metadata,
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
      { correlationId, authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
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

      const event = toCreateEventWaitingForApprovalPurposeVersionDeleted({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
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
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
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
    async updateReversePurpose(
      purposeId: PurposeId,
      reversePurposeUpdateContent: purposeApi.ReversePurposeUpdateContent,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
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
    async deletePurpose(
      purposeId: PurposeId,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
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
    ): Promise<
      WithMetadata<{
        purpose: Purpose;
        isRiskAnalysisValid: boolean;
        updatedVersionId: string;
      }>
    > {
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

      const tenantKind = await retrieveTenantKind(
        authData.organizationId,
        readModelService
      );

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
        data: {
          purpose: updatedPurpose,
          updatedVersionId: archivedVersion.id,
          isRiskAnalysisValid: isRiskAnalysisFormValid(
            updatedPurpose.riskAnalysisForm,
            false,
            tenantKind
          ),
        },
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
      }: {
        purposeId: PurposeId;
        versionId: PurposeVersionId;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<{
        purpose: Purpose;
        isRiskAnalysisValid: boolean;
        updatedVersionId: string;
      }>
    > {
      logger.info(`Suspending Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isSuspendable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const [eservice, tenantKind] = await Promise.all([
        retrieveEService(purpose.data.eserviceId, readModelService),
        retrieveTenantKind(authData.organizationId, readModelService),
      ]);

      const suspender = await getOrganizationRole({
        purpose: purpose.data,
        producerId: eservice.producerId,
        authData,
        readModelService,
      });

      const suspendedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.suspended,
        suspendedAt: new Date(),
        updatedAt: new Date(),
      };

      const { eventToCreate, updatedPurpose } = match(suspender)
        .with(ownership.CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByConsumer: true,
          };
          return {
            eventToCreate: toCreateEventPurposeSuspendedByConsumer({
              purpose: updatedPurpose,
              purposeVersionId: versionId,
              version: purpose.metadata.version,
              correlationId,
            }),
            updatedPurpose,
          };
        })
        .with(ownership.PRODUCER, ownership.SELF_CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByProducer: true,
          };
          return {
            eventToCreate: toCreateEventPurposeSuspendedByProducer({
              purpose: updatedPurpose,
              purposeVersionId: versionId,
              version: purpose.metadata.version,
              correlationId,
            }),
            updatedPurpose,
          };
        })
        .exhaustive();

      const createdEvent = await repository.createEvent(eventToCreate);
      return {
        data: {
          purpose: updatedPurpose,
          isRiskAnalysisValid: isRiskAnalysisFormValid(
            updatedPurpose.riskAnalysisForm,
            false,
            tenantKind
          ),
          updatedVersionId: suspendedPurposeVersion.id,
        },
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

      // Permissions are checked in the readModelService
      return await readModelService.getPurposes(
        authData.organizationId,
        filters,
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
        isRiskAnalysisValid: boolean;
        createdVersionId: string;
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

      const [eservice, tenantKind] = await Promise.all([
        retrieveEService(purpose.data.eserviceId, readModelService),
        retrieveTenantKind(authData.organizationId, readModelService),
      ]);

      const isRiskAnalysisValid = purposeIsDraft(purpose.data)
        ? isRiskAnalysisFormValid(
            purpose.data.riskAnalysisForm,
            false,
            tenantKind
          )
        : true;

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
            isRiskAnalysisValid,
            createdVersionId: newPurposeVersion.id,
          },
          metadata: { version: event.newVersion },
        };
      }

      /**
       * If the purpose is not over quota, we will create a new version directly in active state and
       * also generate the new risk analysis document
       */
      const riskAnalysisDocument = await generateRiskAnalysisDocument({
        eservice,
        purpose: purpose.data,
        dailyCalls: seed.dailyCalls,
        readModelService,
        fileManager,
        pdfGenerator,
        logger,
      });

      const newPurposeVersion: PurposeVersion = {
        id: generateId(),
        riskAnalysis: riskAnalysisDocument,
        state: purposeVersionState.active,
        dailyCalls: seed.dailyCalls,
        firstActivationAt: new Date(),
        createdAt: new Date(),
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
          isRiskAnalysisValid,
          createdVersionId: newPurposeVersion.id,
        },
        metadata: { version: event.newVersion },
      };
    },
    async activatePurposeVersion(
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
      logger.info(`Activating Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      if (purposeVersion.state === purposeVersionState.draft) {
        const riskAnalysisForm = purpose.data.riskAnalysisForm;

        if (!riskAnalysisForm) {
          throw missingRiskAnalysis(purposeId);
        }

        const tenantKind = await retrieveKindOfInvolvedTenantByEServiceMode(
          eservice,
          purpose.data.consumerId,
          readModelService
        );

        validateRiskAnalysisOrThrow({
          riskAnalysisForm:
            riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
          schemaOnlyValidation: false,
          tenantKind,
        });
      }

      const purposeOwnership = await getOrganizationRole({
        purpose: purpose.data,
        producerId: eservice.producerId,
        authData,
        readModelService,
      });

      const { event, updatedPurposeVersion, updatedPurpose } = await match({
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
              eservice,
              readModelService,
              fileManager,
              pdfGenerator,
              correlationId,
              logger,
            });
          }
        )
        .with(
          {
            state: purposeVersionState.draft,
            purposeOwnership: ownership.PRODUCER,
          },
          () => {
            throw tenantIsNotTheConsumer(authData.organizationId);
          }
        )
        .with(
          {
            state: purposeVersionState.waitingForApproval,
            purposeOwnership: ownership.CONSUMER,
          },
          () => {
            throw tenantIsNotTheProducer(authData.organizationId);
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
              eservice,
              readModelService,
              fileManager,
              pdfGenerator,
              correlationId,
              logger,
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
        .otherwise(() => {
          throw tenantNotAllowed(authData.organizationId);
        });

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
    ): Promise<
      WithMetadata<{ purpose: Purpose; isRiskAnalysisValid: boolean }>
    > {
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

      const validatedFormSeed = validateAndTransformRiskAnalysis(
        purposeSeed.riskAnalysisForm,
        false,
        await retrieveTenantKind(authData.organizationId, readModelService)
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
        createdAt: new Date(),
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
        data: { purpose, isRiskAnalysisValid: validatedFormSeed !== undefined },
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async createReversePurpose(
      seed: purposeApi.EServicePurposeSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(
        `Creating Purpose for EService ${seed.eServiceId}, Consumer ${seed.consumerId}`
      );
      const riskAnalysisId: RiskAnalysisId = unsafeBrandId(seed.riskAnalysisId);
      const eserviceId: EServiceId = unsafeBrandId(seed.eServiceId);
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

      const producerKind = await retrieveTenantKind(
        eservice.producerId,
        readModelService
      );

      await retrieveActiveAgreement(eserviceId, consumerId, readModelService);

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId,
        consumerId,
        title: seed.title,
      });

      validateRiskAnalysisOrThrow({
        riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
          riskAnalysis.riskAnalysisForm
        ),
        schemaOnlyValidation: false,
        tenantKind: producerKind,
      });

      const newVersion: PurposeVersion = {
        id: generateId(),
        createdAt: new Date(),
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

      await repository.createEvent(
        toCreateEventPurposeAdded(purpose, correlationId)
      );
      return {
        purpose,
        isRiskAnalysisValid: true,
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
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      const organizationId = authData.organizationId;

      logger.info(`Cloning Purpose ${purposeId}`);

      const tenantKind = await retrieveTenantKind(
        organizationId,
        readModelService
      );

      const purposeToClone = await retrievePurpose(purposeId, readModelService);

      const consumerDelegation = await retrievePurposeDelegation(
        purposeToClone.data,
        readModelService
      );

      assertRequesterCanActAsConsumer(
        purposeToClone.data,
        authData,
        consumerDelegation
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

      await assertPurposeTitleIsNotDuplicated({
        readModelService,
        eserviceId: unsafeBrandId(seed.eserviceId),
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

      const isRiskAnalysisValid = clonedRiskAnalysisForm
        ? validateRiskAnalysis(
            riskAnalysisFormToRiskAnalysisFormToValidate(
              clonedRiskAnalysisForm
            ),
            false,
            tenantKind
          ).type === "valid"
        : false;

      const event = toCreateEventPurposeCloned({
        purpose: clonedPurpose,
        sourcePurposeId: purposeToClone.data.id,
        sourceVersionId: versionToClone.id,
        correlationId,
      });
      await repository.createEvent(event);
      return {
        purpose: clonedPurpose,
        isRiskAnalysisValid,
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
  };
}

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

const getOrganizationRole = async ({
  purpose,
  producerId,
  authData,
  readModelService,
}: {
  purpose: Purpose;
  producerId: TenantId;
  authData: UIAuthData | M2MAdminAuthData;
  readModelService: ReadModelService;
}): Promise<Ownership> => {
  if (
    producerId === purpose.consumerId &&
    authData.organizationId === producerId
  ) {
    return ownership.SELF_CONSUMER;
  }

  try {
    assertRequesterCanActAsProducer(
      { id: purpose.eserviceId, producerId },
      authData,
      await readModelService.getActiveProducerDelegationByEserviceId(
        purpose.eserviceId
      )
    );
    return ownership.PRODUCER;
  } catch {
    try {
      assertRequesterCanActAsConsumer(
        purpose,
        authData,
        await retrievePurposeDelegation(purpose, readModelService)
      );
      return ownership.CONSUMER;
    } catch {
      throw tenantNotAllowed(authData.organizationId);
    }
  }
};

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
  readModelService: ReadModelService
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

const performUpdatePurpose = async (
  purposeId: PurposeId,
  {
    mode,
    updateContent,
  }:
    | { mode: "Deliver"; updateContent: purposeApi.PurposeUpdateContent }
    | {
        mode: "Receive";
        updateContent: purposeApi.ReversePurposeUpdateContent;
      },
  authData: UIAuthData,
  readModelService: ReadModelService,
  correlationId: CorrelationId,
  repository: {
    createEvent: (createEvent: CreateEvent<PurposeEvent>) => Promise<unknown>;
  }
  // eslint-disable-next-line max-params
): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> => {
  const purpose = await retrievePurpose(purposeId, readModelService);
  assertPurposeIsDraft(purpose.data);

  if (updateContent.title !== purpose.data.title) {
    await assertPurposeTitleIsNotDuplicated({
      readModelService,
      eserviceId: purpose.data.eserviceId,
      consumerId: purpose.data.consumerId,
      title: updateContent.title,
    });
  }

  const consumerDelegation = await retrievePurposeDelegation(
    purpose.data,
    readModelService
  );

  assertRequesterCanActAsConsumer(purpose.data, authData, consumerDelegation);

  const eservice = await retrieveEService(
    purpose.data.eserviceId,
    readModelService
  );
  assertEserviceMode(eservice, mode);
  assertConsistentFreeOfCharge(
    updateContent.isFreeOfCharge,
    updateContent.freeOfChargeReason
  );

  const tenantKind = await retrieveKindOfInvolvedTenantByEServiceMode(
    eservice,
    purpose.data.consumerId,
    readModelService
  );

  const newRiskAnalysis: PurposeRiskAnalysisForm | undefined =
    mode === eserviceMode.deliver
      ? validateAndTransformRiskAnalysis(
          updateContent.riskAnalysisForm,
          true,
          tenantKind
        )
      : reverseValidateAndTransformRiskAnalysis(
          purpose.data.riskAnalysisForm,
          true,
          tenantKind
        );

  const updatedPurpose: Purpose = {
    ...purpose.data,
    title: updateContent.title,
    description: updateContent.description,
    isFreeOfCharge: updateContent.isFreeOfCharge,
    freeOfChargeReason: updateContent.freeOfChargeReason,
    versions: [
      {
        ...purpose.data.versions[0],
        dailyCalls: updateContent.dailyCalls,
        updatedAt: new Date(),
      },
    ],
    updatedAt: new Date(),
    riskAnalysisForm: newRiskAnalysis,
  };

  const event = toCreateEventDraftPurposeUpdated({
    purpose: updatedPurpose,
    version: purpose.metadata.version,
    correlationId,
  });
  await repository.createEvent(event);

  return {
    purpose: updatedPurpose,
    isRiskAnalysisValid: isRiskAnalysisFormValid(
      updatedPurpose.riskAnalysisForm,
      false,
      tenantKind
    ),
  };
};

async function generateRiskAnalysisDocument({
  eservice,
  purpose,
  dailyCalls,
  readModelService,
  fileManager,
  pdfGenerator,
  logger,
}: {
  eservice: EService;
  purpose: Purpose;
  dailyCalls: number;
  readModelService: ReadModelService;
  fileManager: FileManager;
  pdfGenerator: PDFGenerator;
  logger: Logger;
}): Promise<PurposeVersionDocument> {
  const [producer, consumer, producerDelegation, consumerDelegation] =
    await Promise.all([
      retrieveTenant(eservice.producerId, readModelService),
      retrieveTenant(purpose.consumerId, readModelService),
      readModelService.getActiveProducerDelegationByEserviceId(eservice.id),
      retrievePurposeDelegation(purpose, readModelService),
    ]);

  const [producerDelegate, consumerDelegate] = await Promise.all([
    producerDelegation &&
      retrieveTenant(producerDelegation.delegateId, readModelService),
    consumerDelegation &&
      retrieveTenant(consumerDelegation.delegateId, readModelService),
  ]);

  const eserviceInfo: PurposeDocumentEServiceInfo = {
    name: eservice.name,
    mode: eservice.mode,
    producerName: producer.name,
    producerIpaCode: getIpaCode(producer),
    consumerName: consumer.name,
    consumerIpaCode: getIpaCode(consumer),
    producerDelegationId: producerDelegation?.id,
    producerDelegateName: producerDelegate?.name,
    producerDelegateIpaCode: producerDelegate && getIpaCode(producerDelegate),
    consumerDelegationId: consumerDelegation?.id,
    consumerDelegateName: consumerDelegate?.name,
    consumerDelegateIpaCode: consumerDelegate && getIpaCode(consumerDelegate),
  };

  function getTenantKind(tenant: Tenant): TenantKind {
    if (!tenant.kind) {
      throw tenantKindNotFound(tenant.id);
    }
    return tenant.kind;
  }

  const tenantKind = match(eservice.mode)
    .with(eserviceMode.deliver, () => getTenantKind(consumer))
    .with(eserviceMode.receive, () => getTenantKind(producer))
    .exhaustive();

  return await riskAnalysisDocumentBuilder(
    pdfGenerator,
    fileManager,
    config,
    logger
  ).createRiskAnalysisDocument(
    purpose,
    dailyCalls,
    eserviceInfo,
    tenantKind,
    "it"
  );
}

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
  updatedPurpose: Purpose;
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
    updatedPurpose,
  };
}

function activatePurposeVersionFromOverQuotaSuspendedLogic(
  purpose: WithMetadata<Purpose>,
  purposeVersion: PurposeVersion,
  correlationId: CorrelationId
): {
  event: CreateEvent<PurposeEvent>;
  updatedPurpose: Purpose;
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
    updatedPurpose,
  };
}

async function activatePurposeLogic({
  fromState,
  purpose,
  purposeVersion,
  eservice,
  readModelService,
  fileManager,
  pdfGenerator,
  correlationId,
  logger,
}: {
  fromState:
    | typeof purposeVersionState.draft
    | typeof purposeVersionState.waitingForApproval;
  purpose: WithMetadata<Purpose>;
  purposeVersion: PurposeVersion;
  eservice: EService;
  readModelService: ReadModelService;
  fileManager: FileManager;
  pdfGenerator: PDFGenerator;
  correlationId: CorrelationId;
  logger: Logger;
}): Promise<{
  event: CreateEvent<PurposeEvent>;
  updatedPurpose: Purpose;
  updatedPurposeVersion: PurposeVersion;
}> {
  const updatedPurposeVersion: PurposeVersion = {
    ...purposeVersion,
    state: purposeVersionState.active,
    riskAnalysis: await generateRiskAnalysisDocument({
      eservice,
      purpose: purpose.data,
      dailyCalls: purposeVersion.dailyCalls,
      readModelService,
      fileManager,
      pdfGenerator,
      logger,
    }),
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
      updatedPurpose,
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
      updatedPurpose,
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
  updatedPurpose: Purpose;
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
    .otherwise(() => purposeVersionState.active);

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

  if (
    purposeOwnership === ownership.PRODUCER ||
    purposeOwnership === ownership.SELF_CONSUMER
  ) {
    return {
      event: toCreateEventPurposeVersionUnsuspenedByProducer({
        purpose: { ...updatedPurpose, suspendedByProducer: false },
        versionId: purposeVersion.id,
        version: purpose.metadata.version,
        correlationId,
      }),
      updatedPurposeVersion,
      updatedPurpose: {
        ...updatedPurpose,
        suspendedByProducer: false,
      },
    };
  } else {
    return {
      event: toCreateEventPurposeVersionUnsuspenedByConsumer({
        purpose: { ...updatedPurpose, suspendedByConsumer: false },
        versionId: purposeVersion.id,
        version: purpose.metadata.version,
        correlationId,
      }),
      updatedPurposeVersion,
      updatedPurpose: {
        ...updatedPurpose,
        suspendedByConsumer: false,
      },
    };
  }
}
