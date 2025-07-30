import { z } from "zod";
import {
  AppContext,
  CreateEvent,
  DB,
  FileManager,
  InternalAuthData,
  Logger,
  M2MAdminAuthData,
  M2MAuthData,
  Ownership,
  PDFGenerator,
  UIAuthData,
  WithLogger,
  eventRepository,
  ownership,
} from "pagopa-interop-commons";
import { agreementApi } from "pagopa-interop-api-clients";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
  AgreementState,
  AttributeId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  ListResult,
  Tenant,
  TenantId,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  generateId,
  CompactTenant,
  CorrelationId,
  DelegationId,
  AgreementStamp,
} from "pagopa-interop-models";
import {
  certifiedAttributesSatisfied,
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "pagopa-interop-agreement-lifecycle";
import { match } from "ts-pattern";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
  agreementSubmissionFailed,
  delegationNotFound,
  descriptorNotFound,
  eServiceNotFound,
  noNewerDescriptor,
  tenantIsNotTheDelegateConsumer,
  publishedDescriptorNotFound,
  tenantNotFound,
  unexpectedVersionFormat,
  tenantIsNotTheDelegate,
} from "../model/domain/errors.js";
import {
  ActiveDelegations,
  CompactEService,
  CompactOrganization,
  UpdateAgreementSeed,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchivedByConsumer,
  toCreateEventAgreementArchivedByRevokedDelegation,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementDeletedByRevokedDelegation,
  toCreateEventAgreementRejected,
  toCreateEventAgreementSetMissingCertifiedAttributesByPlatform,
  toCreateEventAgreementSubmitted,
  toCreateEventDraftAgreementUpdated,
} from "../model/domain/toEvent.js";
import {
  agreementArchivableStates,
  agreementClonableStates,
  agreementCloningConflictingStates,
  agreementDeletableStates,
  agreementRejectableStates,
  agreementSuspendableStates,
  agreementUpdatableStates,
  agreementUpgradableStates,
  assertActivableState,
  assertRequesterCanActAsProducer,
  assertRequesterCanActAsConsumerOrProducer,
  assertRequesterCanRetrieveAgreement,
  assertCanWorkOnConsumerDocuments,
  assertExpectedState,
  assertRequesterIsDelegateConsumer,
  assertSubmittableState,
  failOnActivationFailure,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  validateActiveOrPendingAgreement,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  validateSubmitOnDescriptor,
  verifyCreationConflictingAgreements,
  verifySubmissionConflictingAgreements,
  assertRequesterCanActAsConsumer,
} from "../model/domain/agreement-validators.js";
import { config } from "../config/config.js";
import {
  archiveRelatedToAgreements,
  createActivationEvent,
  createActivationUpdateAgreementSeed,
} from "./agreementActivationProcessor.js";
import {
  ContractBuilder,
  contractBuilder,
} from "./agreementContractBuilder.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import {
  agreementStateByFlags,
  computeAgreementsStateByAttribute,
  nextStateByAttributesFSM,
  suspendedByConsumerFlag,
  suspendedByPlatformFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import {
  createSubmissionUpdateAgreementSeed,
  isActiveOrSuspended,
  validateConsumerEmail,
} from "./agreementSubmissionProcessor.js";
import {
  createAgreementSuspendedEvent,
  createSuspensionUpdatedAgreement,
} from "./agreementSuspensionProcessor.js";
import { createUpgradeOrNewDraft } from "./agreementUpgradeProcessor.js";
import {
  AgreementEServicesQueryFilters,
  AgreementQueryFilters,
  ReadModelService,
} from "./readModelService.js";

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

export const retrieveAgreement = async (
  agreementId: AgreementId,
  readModelService: ReadModelService
): Promise<WithMetadata<Agreement>> => {
  const agreement = await readModelService.getAgreementById(agreementId);
  if (!agreement) {
    throw agreementNotFound(agreementId);
  }

  return agreement;
};

export const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (!descriptor) {
    throw descriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

function retrieveAgreementDocument(
  agreement: Agreement,
  documentId: AgreementDocumentId
): AgreementDocument {
  const document = agreement.consumerDocuments.find((d) => d.id === documentId);

  if (!document) {
    throw agreementDocumentNotFound(documentId, agreement.id);
  }
  return document;
}

export const getActiveConsumerAndProducerDelegations = async (
  agreement: Agreement,
  readModelService: ReadModelService,
  cachedActiveDelegations?: ActiveDelegations
): Promise<ActiveDelegations> => ({
  producerDelegation:
    cachedActiveDelegations?.producerDelegation ??
    (await readModelService.getActiveProducerDelegationByEserviceId(
      agreement.eserviceId
    )),
  consumerDelegation:
    cachedActiveDelegations?.consumerDelegation ??
    (await readModelService.getActiveConsumerDelegationByAgreement(agreement)),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function agreementServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager,
  pdfGenerator: PDFGenerator
) {
  const repository = eventRepository(dbInstance, agreementEventToBinaryData);
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<Agreement>> {
      logger.info(
        `Getting agreements with filters: ${JSON.stringify(
          filters
        )}, offset = ${offset}, limit = ${limit}`
      );

      // Permissions are checked in the readModelService
      return await readModelService.getAgreements(
        authData.organizationId,
        filters,
        limit,
        offset
      );
    },
    async getAgreementById(
      agreementId: AgreementId,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);
      await assertRequesterCanRetrieveAgreement(
        agreement.data,
        authData,
        readModelService
      );
      return agreement;
    },
    async createAgreement(
      {
        eserviceId,
        descriptorId,
        delegationId,
      }: {
        eserviceId: EServiceId;
        descriptorId: DescriptorId;
        delegationId?: DelegationId;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(
        `Creating agreement for EService ${eserviceId} and Descriptor ${descriptorId}${
          delegationId ? ` with delegation ${delegationId}` : ""
        }`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      const descriptor = validateCreationOnDescriptor(eservice, descriptorId);

      const consumer = await getConsumerFromDelegationOrRequester(
        eserviceId,
        delegationId,
        authData,
        readModelService
      );

      await verifyCreationConflictingAgreements(
        consumer.id,
        eserviceId,
        readModelService
      );

      if (eservice.producerId !== consumer.id) {
        validateCertifiedAttributes({ descriptor, consumer });
      }

      const agreement: Agreement = {
        id: generateId(),
        eserviceId,
        descriptorId,
        producerId: eservice.producerId,
        consumerId: consumer.id,
        state: agreementState.draft,
        verifiedAttributes: [],
        certifiedAttributes: [],
        declaredAttributes: [],
        consumerDocuments: [],
        createdAt: new Date(),
        stamps: {},
      };

      const { newVersion } = await repository.createEvent(
        toCreateEventAgreementAdded(agreement, correlationId)
      );

      return { data: agreement, metadata: { version: newVersion } };
    },
    async getAgreementsProducers(
      producerName: string | undefined,
      limit: number,
      offset: number,
      { authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving producers from agreements with producer name ${producerName}`
      );

      // Permissions are checked in the readModelService
      return await readModelService.getAgreementsProducers(
        authData.organizationId,
        producerName,
        limit,
        offset
      );
    },
    async getAgreementsConsumers(
      consumerName: string | undefined,
      limit: number,
      offset: number,
      { authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving consumers from agreements with consumer name ${consumerName}`
      );

      // Permissions are checked in the readModelService
      return await readModelService.getAgreementsConsumers(
        authData.organizationId,
        consumerName,
        limit,
        offset
      );
    },
    async updateAgreement(
      agreementId: AgreementId,
      agreement: agreementApi.AgreementUpdatePayload,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Agreement> {
      logger.info(`Updating agreement ${agreementId}`);

      const agreementToBeUpdated = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertExpectedState(
        agreementId,
        agreementToBeUpdated.data.state,
        agreementUpdatableStates
      );

      const activeConsumerDelegation =
        await readModelService.getActiveConsumerDelegationByAgreement(
          agreementToBeUpdated.data
        );
      assertRequesterCanActAsConsumer(
        agreementToBeUpdated.data,
        authData,
        activeConsumerDelegation
      );

      const updatedAgreement: Agreement = {
        ...agreementToBeUpdated.data,
        consumerNotes: agreement.consumerNotes,
      };

      await repository.createEvent(
        toCreateEventDraftAgreementUpdated(
          updatedAgreement,
          agreementToBeUpdated.metadata.version,
          correlationId
        )
      );

      return updatedAgreement;
    },
    async deleteAgreementById(
      agreementId: AgreementId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<void> {
      logger.info(`Deleting agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementDeletableStates
      );

      assertRequesterCanActAsConsumer(
        agreement.data,
        authData,
        await readModelService.getActiveConsumerDelegationByAgreement(
          agreement.data
        )
      );

      for (const d of agreement.data.consumerDocuments) {
        await fileManager.delete(config.s3Bucket, d.path, logger);
      }

      await repository.createEvent(
        toCreateEventAgreementDeleted(
          agreement.data,
          agreement.metadata.version,
          correlationId
        )
      );
    },
    async internalDeleteAgreementAfterDelegationRevocation(
      agreementId: AgreementId,
      delegationId: DelegationId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Deleting agreement ${agreementId} due to revocation of delegation ${delegationId}`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementDeletableStates
      );

      for (const d of agreement.data.consumerDocuments) {
        await fileManager.delete(config.s3Bucket, d.path, logger);
      }

      await repository.createEvent(
        toCreateEventAgreementDeletedByRevokedDelegation(
          agreement.data,
          delegationId,
          agreement.metadata.version,
          correlationId
        )
      );
    },
    async submitAgreement(
      agreementId: AgreementId,
      payload: agreementApi.AgreementSubmissionPayload,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(`Submitting agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertSubmittableState(agreement.data.state, agreement.data.id);

      const activeDelegations = await getActiveConsumerAndProducerDelegations(
        agreement.data,
        readModelService
      );
      assertRequesterCanActAsConsumer(
        agreement.data,
        authData,
        activeDelegations.consumerDelegation
      );

      await verifySubmissionConflictingAgreements(
        agreement.data,
        readModelService
      );

      const consumer = await retrieveTenant(
        agreement.data.consumerId,
        readModelService
      );

      await validateConsumerEmail(consumer, agreement.data);

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        readModelService
      );

      const descriptor = await validateSubmitOnDescriptor(
        eservice,
        agreement.data.descriptorId
      );

      const producer = await retrieveTenant(
        agreement.data.producerId,
        readModelService
      );

      const nextStateByAttributes = nextStateByAttributesFSM(
        agreement.data,
        descriptor,
        consumer
      );

      const suspendedByPlatform = suspendedByPlatformFlag(
        nextStateByAttributes
      );

      const setToMissingCertifiedAttributesByPlatformEvent =
        maybeCreateSetToMissingCertifiedAttributesByPlatformEvent(
          agreement,
          nextStateByAttributes,
          suspendedByPlatform,
          correlationId
        );

      if (setToMissingCertifiedAttributesByPlatformEvent) {
        /* In this case, it means that one of the certified attributes is not
          valid anymore. We put the agreement in the missingCertifiedAttributes state
          and fail the submission */

        await repository.createEvent(
          setToMissingCertifiedAttributesByPlatformEvent
        );
        throw agreementSubmissionFailed(agreement.data.id);
      }

      const newState = agreementStateByFlags(
        nextStateByAttributes,
        // TODO this should actually recalculate flags and consider them
        // in the calculation of the new state, otherwise a suspended agreement
        // that was upgraded will become active - https://pagopa.atlassian.net/browse/IMN-626
        undefined,
        undefined,
        suspendedByPlatform
      );

      validateActiveOrPendingAgreement(agreement.data.id, newState);

      const updateSeed = createSubmissionUpdateAgreementSeed(
        descriptor,
        consumer,
        eservice,
        agreement.data,
        payload,
        newState,
        authData,
        suspendedByPlatform,
        activeDelegations.consumerDelegation
      );

      const agreements = (
        await readModelService.getAllAgreements({
          consumerId: agreement.data.consumerId,
          eserviceId: agreement.data.eserviceId,
          agreementStates: [agreementState.active, agreementState.suspended],
        })
      ).filter((a: WithMetadata<Agreement>) => a.data.id !== agreement.data.id);

      const hasRelatedAgreements = agreements.length > 0;
      const updatedAgreement = {
        ...agreement.data,
        ...updateSeed,
      };

      const contractBuilderInstance = contractBuilder(
        readModelService,
        pdfGenerator,
        fileManager,
        config,
        logger
      );

      const isFirstActivation =
        updatedAgreement.state === agreementState.active &&
        !hasRelatedAgreements;

      const submittedAgreement = await addContractOnFirstActivation(
        isFirstActivation,
        contractBuilderInstance,
        eservice,
        consumer,
        producer,
        updatedAgreement,
        activeDelegations
      );

      const agreementEvent =
        submittedAgreement.state === agreementState.active
          ? toCreateEventAgreementActivated(
              submittedAgreement,
              agreement.metadata.version,
              correlationId
            )
          : toCreateEventAgreementSubmitted(
              submittedAgreement,
              agreement.metadata.version,
              correlationId
            );

      const archivedAgreementsUpdates: Array<CreateEvent<AgreementEvent>> =
        /*
          This condition can only check if state is ACTIVE
          at this point the SUSPENDED state is not available
          after validateActiveOrPendingAgreement validation.

          TODO: this will not be true anymore if https://pagopa.atlassian.net/browse/IMN-626
          is confirmed and gets fixed - the agreement could also be in SUSPENDED state.
          Remove the comment at that point.
        */
        isActiveOrSuspended(submittedAgreement.state)
          ? agreements.map((agreement) =>
              createAgreementArchivedByUpgradeEvent(
                agreement,
                authData,
                activeDelegations,
                correlationId
              )
            )
          : [];

      const createdEvents = await repository.createEvents([
        agreementEvent,
        ...archivedAgreementsUpdates,
      ]);

      const newVersion = Math.max(
        0,
        ...createdEvents.map((event) => event.newVersion)
      );

      return {
        data: submittedAgreement,
        metadata: {
          version: newVersion,
        },
      };
    },
    async upgradeAgreement(
      agreementId: AgreementId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(`Upgrading agreement ${agreementId}`);

      const agreementToBeUpgraded = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertExpectedState(
        agreementId,
        agreementToBeUpgraded.data.state,
        agreementUpgradableStates
      );

      const activeDelegations = await getActiveConsumerAndProducerDelegations(
        agreementToBeUpgraded.data,
        readModelService
      );
      assertRequesterCanActAsConsumer(
        agreementToBeUpgraded.data,
        authData,
        activeDelegations.consumerDelegation
      );

      const eservice = await retrieveEService(
        agreementToBeUpgraded.data.eserviceId,
        readModelService
      );

      const newDescriptor = eservice.descriptors.find(
        (d) => d.state === descriptorState.published
      );
      if (newDescriptor === undefined) {
        throw publishedDescriptorNotFound(eservice.id);
      }
      const latestDescriptorVersion = z
        .preprocess((x) => Number(x), z.number())
        .safeParse(newDescriptor.version);
      if (!latestDescriptorVersion.success) {
        throw unexpectedVersionFormat(eservice.id, newDescriptor.id);
      }

      const currentDescriptor = retrieveDescriptor(
        agreementToBeUpgraded.data.descriptorId,
        eservice
      );

      const currentVersion = z
        .preprocess((x) => Number(x), z.number())
        .safeParse(currentDescriptor.version);
      if (!currentVersion.success) {
        throw unexpectedVersionFormat(eservice.id, currentDescriptor.id);
      }

      if (latestDescriptorVersion.data <= currentVersion.data) {
        throw noNewerDescriptor(eservice.id, currentDescriptor.id);
      }

      const consumer = await retrieveTenant(
        agreementToBeUpgraded.data.consumerId,
        readModelService
      );

      const producer = await retrieveTenant(
        agreementToBeUpgraded.data.producerId,
        readModelService
      );

      const isSelfConsumer =
        eservice.producerId === agreementToBeUpgraded.data.consumerId;

      if (!isSelfConsumer) {
        validateCertifiedAttributes({
          descriptor: newDescriptor,
          consumer,
        });
      }

      const verifiedValid = verifiedAttributesSatisfied(
        agreementToBeUpgraded.data.producerId,
        newDescriptor.attributes,
        consumer.attributes
      );

      const declaredValid = declaredAttributesSatisfied(
        newDescriptor.attributes,
        consumer.attributes
      );

      const contractBuilderInstance = contractBuilder(
        readModelService,
        pdfGenerator,
        fileManager,
        config,
        logger
      );

      const canBeUpgraded = isSelfConsumer || (verifiedValid && declaredValid);

      const [agreement, events] = await createUpgradeOrNewDraft({
        agreement: agreementToBeUpgraded,
        newDescriptor,
        eservice,
        consumer,
        producer,
        readModelService,
        canBeUpgraded,
        copyFile: fileManager.copy,
        authData,
        activeDelegations,
        contractBuilder: contractBuilderInstance,
        correlationId,
        logger,
      });

      const createdEvents = await repository.createEvents(events);

      const newVersion = Math.max(
        0,
        ...createdEvents
          .filter((e) => e.streamId === agreement.id)
          .map((event) => event.newVersion)
      );

      return {
        data: agreement,
        metadata: {
          version: newVersion,
        },
      };
    },
    async cloneAgreement(
      agreementId: AgreementId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(`Cloning agreement ${agreementId}`);

      const agreementToBeCloned = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertExpectedState(
        agreementId,
        agreementToBeCloned.data.state,
        agreementClonableStates
      );

      const activeConsumerDelegation =
        await readModelService.getActiveConsumerDelegationByAgreement(
          agreementToBeCloned.data
        );
      assertRequesterCanActAsConsumer(
        agreementToBeCloned.data,
        authData,
        activeConsumerDelegation
      );

      const activeAgreement = await readModelService.getAllAgreements({
        consumerId: authData.organizationId,
        eserviceId: agreementToBeCloned.data.eserviceId,
        agreementStates: agreementCloningConflictingStates,
      });
      if (activeAgreement.length > 0) {
        throw agreementAlreadyExists(
          authData.organizationId,
          agreementToBeCloned.data.eserviceId
        );
      }

      const eservice = await retrieveEService(
        agreementToBeCloned.data.eserviceId,
        readModelService
      );

      const descriptor = retrieveDescriptor(
        agreementToBeCloned.data.descriptorId,
        eservice
      );

      validateCertifiedAttributes({
        descriptor,
        consumer: await retrieveTenant(
          agreementToBeCloned.data.consumerId,
          readModelService
        ),
      });

      const id = generateId<AgreementId>();
      const newAgreement: Agreement = {
        ...agreementToBeCloned.data,
        id,
        verifiedAttributes: [],
        certifiedAttributes: [],
        declaredAttributes: [],
        state: agreementState.draft,
        createdAt: new Date(),
        consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
          id,
          agreementToBeCloned.data,
          fileManager.copy,
          logger
        ),
        stamps: {},
      };

      const createdEvent = await repository.createEvent(
        toCreateEventAgreementAdded(newAgreement, correlationId)
      );

      return {
        data: newAgreement,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async addConsumerDocument(
      agreementId: AgreementId,
      documentSeed: agreementApi.DocumentSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<AgreementDocument>> {
      logger.info(`Adding a consumer document to agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertCanWorkOnConsumerDocuments(agreement.data.state);

      const existentDocument = agreement.data.consumerDocuments.find(
        (d) => d.id === documentSeed.id
      );

      if (existentDocument) {
        throw agreementDocumentAlreadyExists(agreementId);
      }

      const activeConsumerDelegation =
        await readModelService.getActiveConsumerDelegationByAgreement(
          agreement.data
        );
      assertRequesterCanActAsConsumer(
        agreement.data,
        authData,
        activeConsumerDelegation
      );

      const newDocument = apiAgreementDocumentToAgreementDocument(documentSeed);

      const updatedAgreement = {
        ...agreement.data,
        consumerDocuments: [...agreement.data.consumerDocuments, newDocument],
      };

      const createdEvent = await repository.createEvent(
        toCreateEventAgreementConsumerDocumentAdded(
          newDocument.id,
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      );

      return {
        data: newDocument,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async getAgreementConsumerDocuments(
      agreementId: AgreementId,
      { offset, limit }: agreementApi.GetAgreementConsumerDocumentsQueryParams,
      {
        authData,
        logger,
      }: WithLogger<AppContext<M2MAdminAuthData | M2MAuthData>>
    ): Promise<ListResult<AgreementDocument>> {
      logger.info(`Retrieving consumer documents for agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      await assertRequesterCanRetrieveAgreement(
        agreement.data,
        authData,
        readModelService
      );

      return readModelService.getAgreementConsumerDocuments(
        agreementId,
        offset,
        limit
      );
    },
    async getAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData | M2MAuthData>>
    ): Promise<AgreementDocument> {
      logger.info(
        `Retrieving consumer document ${documentId} from agreement ${agreementId}`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      await assertRequesterCanRetrieveAgreement(
        agreement.data,
        authData,
        readModelService
      );

      return retrieveAgreementDocument(agreement.data, documentId);
    },
    async suspendAgreement(
      {
        agreementId,
        delegationId,
      }: { agreementId: AgreementId; delegationId: DelegationId | undefined },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(
        `Suspending agreement ${agreementId}${
          delegationId ? ` with delegation ${delegationId}` : ""
        }`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementSuspendableStates
      );

      const activeDelegations = await getActiveConsumerAndProducerDelegations(
        agreement.data,
        readModelService
      );

      const agreementOwnership = assertRequesterCanActAsConsumerOrProducer(
        agreement.data,
        delegationId,
        activeDelegations,
        authData
      );

      const [eservice, consumer] = await Promise.all([
        retrieveEService(agreement.data.eserviceId, readModelService),
        retrieveTenant(agreement.data.consumerId, readModelService),
      ]);

      const descriptor = retrieveDescriptor(
        agreement.data.descriptorId,
        eservice
      );

      const updatedAgreement: Agreement = createSuspensionUpdatedAgreement({
        agreement: agreement.data,
        authData,
        descriptor,
        consumer,
        activeDelegations,
        agreementOwnership,
      });

      const createdEvent = await repository.createEvent(
        createAgreementSuspendedEvent(
          correlationId,
          updatedAgreement,
          agreement,
          agreementOwnership
        )
      );

      return {
        data: updatedAgreement,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async getAgreementsEServices(
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number,
      { authData, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ListResult<CompactEService>> {
      logger.info(
        `Retrieving EServices from agreements with filters: ${JSON.stringify(
          filters
        )}, offset ${offset}, limit ${limit}`
      );

      // Permissions are checked in the readModelService
      return await readModelService.getAgreementsEServices(
        authData.organizationId,
        filters,
        limit,
        offset
      );
    },
    async removeAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(
        `Removing consumer document ${documentId} from agreement ${agreementId}`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertCanWorkOnConsumerDocuments(agreement.data.state);

      const activeConsumerDelegation =
        await readModelService.getActiveConsumerDelegationByAgreement(
          agreement.data
        );

      assertRequesterCanActAsConsumer(
        agreement.data,
        authData,
        activeConsumerDelegation
      );

      const existentDocument = retrieveAgreementDocument(
        agreement.data,
        documentId
      );

      await fileManager.delete(config.s3Bucket, existentDocument.path, logger);

      const updatedAgreement = {
        ...agreement.data,
        consumerDocuments: agreement.data.consumerDocuments.filter(
          (d) => d.id !== documentId
        ),
      };

      const createdEvent = await repository.createEvent(
        toCreateEventAgreementConsumerDocumentRemoved(
          documentId,
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      );

      return {
        data: updatedAgreement,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async rejectAgreement(
      agreementId: AgreementId,
      rejectionReason: string,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(`Rejecting agreement ${agreementId}`);

      const agreementToBeRejected = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertExpectedState(
        agreementId,
        agreementToBeRejected.data.state,
        agreementRejectableStates
      );

      const activeProducerDelegation =
        await readModelService.getActiveProducerDelegationByEserviceId(
          agreementToBeRejected.data.eserviceId
        );
      assertRequesterCanActAsProducer(
        agreementToBeRejected.data,
        authData,
        activeProducerDelegation
      );

      const eservice = await retrieveEService(
        agreementToBeRejected.data.eserviceId,
        readModelService
      );

      const descriptor = retrieveDescriptor(
        agreementToBeRejected.data.descriptorId,
        eservice
      );

      const consumer = await retrieveTenant(
        agreementToBeRejected.data.consumerId,
        readModelService
      );

      const rejectedAgreement: Agreement = {
        ...agreementToBeRejected.data,
        state: agreementState.rejected,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice,
          descriptor,
          consumer
        ),
        rejectionReason,
        suspendedByConsumer: undefined,
        suspendedByProducer: undefined,
        suspendedByPlatform: undefined,
        stamps: {
          ...agreementToBeRejected.data.stamps,
          rejection: createStamp(authData, {
            producerDelegation: activeProducerDelegation,
            consumerDelegation: undefined,
          }),
        },
      };

      const { newVersion } = await repository.createEvent(
        toCreateEventAgreementRejected(
          rejectedAgreement,
          agreementToBeRejected.metadata.version,
          correlationId
        )
      );
      return { data: rejectedAgreement, metadata: { version: newVersion } };
    },
    async activateAgreement(
      {
        agreementId,
        delegationId,
      }: {
        agreementId: AgreementId;
        delegationId: DelegationId | undefined;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Agreement>> {
      logger.info(
        `Activating agreement ${agreementId}${
          delegationId ? ` with delegation ${delegationId}` : ""
        }`
      );

      const contractBuilderInstance = contractBuilder(
        readModelService,
        pdfGenerator,
        fileManager,
        config,
        logger
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertActivableState(agreement.data);

      const activeDelegations = await getActiveConsumerAndProducerDelegations(
        agreement.data,
        readModelService
      );

      const agreementOwnership = ((): Ownership => {
        if (agreement.data.state === agreementState.pending) {
          if (
            delegationId &&
            delegationId !== activeDelegations.producerDelegation?.id
          ) {
            throw tenantIsNotTheDelegate(authData.organizationId);
          }

          assertRequesterCanActAsProducer(
            agreement.data,
            authData,
            activeDelegations.producerDelegation
          );
          return ownership.PRODUCER;
        } else {
          return assertRequesterCanActAsConsumerOrProducer(
            agreement.data,
            delegationId,
            activeDelegations,
            authData
          );
        }
      })();

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        readModelService
      );

      const descriptor = validateActivationOnDescriptor(
        eservice,
        agreement.data.descriptorId
      );

      const [consumer, producer] = await Promise.all([
        retrieveTenant(agreement.data.consumerId, readModelService),
        retrieveTenant(agreement.data.producerId, readModelService),
      ]);

      /* nextAttributesState VS targetDestinationState
      -- targetDestinationState is the state where the caller wants to go (active, in this case)
      -- nextStateByAttributes is the next state of the Agreement based the attributes of the consumer
      */
      const targetDestinationState = agreementState.active;
      const nextStateByAttributes = nextStateByAttributesFSM(
        agreement.data,
        descriptor,
        consumer
      );

      const suspendedByPlatform = suspendedByPlatformFlag(
        nextStateByAttributes
      );

      const setToMissingCertifiedAttributesByPlatformEvent =
        maybeCreateSetToMissingCertifiedAttributesByPlatformEvent(
          agreement,
          nextStateByAttributes,
          suspendedByPlatform,
          correlationId
        );
      if (setToMissingCertifiedAttributesByPlatformEvent) {
        /* In this case, it means that one of the certified attributes is not
          valid anymore. We put the agreement in the missingCertifiedAttributes state
          and fail the activation */
        await repository.createEvent(
          setToMissingCertifiedAttributesByPlatformEvent
        );
        throw agreementActivationFailed(agreement.data.id);
      }

      const { suspendedByConsumer, suspendedByProducer } = getSuspensionFlags(
        agreementOwnership,
        agreement.data,
        authData,
        targetDestinationState,
        activeDelegations
      );

      const newState = agreementStateByFlags(
        nextStateByAttributes,
        suspendedByProducer,
        suspendedByConsumer,
        suspendedByPlatform
      );

      failOnActivationFailure(newState, agreement.data);

      const isFirstActivation =
        agreement.data.state === agreementState.pending &&
        newState === agreementState.active;

      const updatedAgreementSeed: UpdateAgreementSeed =
        createActivationUpdateAgreementSeed({
          isFirstActivation,
          newState,
          descriptor,
          consumer,
          eservice,
          authData,
          agreement: agreement.data,
          suspendedByConsumer,
          suspendedByProducer,
          suspendedByPlatform,
          activeDelegations,
          agreementOwnership,
        });

      const updatedAgreementWithoutContract: Agreement = {
        ...agreement.data,
        ...updatedAgreementSeed,
      };

      const updatedAgreement: Agreement = await addContractOnFirstActivation(
        isFirstActivation,
        contractBuilderInstance,
        eservice,
        consumer,
        producer,
        updatedAgreementWithoutContract,
        activeDelegations
      );

      const suspendedByPlatformChanged =
        agreement.data.suspendedByPlatform !==
        updatedAgreement.suspendedByPlatform;

      const activationEvents = await createActivationEvent(
        isFirstActivation,
        updatedAgreement,
        agreement.data.suspendedByPlatform,
        suspendedByPlatformChanged,
        agreement.metadata.version,
        agreementOwnership,
        correlationId
      );

      const archiveEvents = await archiveRelatedToAgreements(
        agreement.data,
        authData,
        activeDelegations,
        readModelService,
        correlationId
      );

      const createdEvents = await repository.createEvents([
        ...activationEvents,
        ...archiveEvents,
      ]);

      const newVersion = Math.max(
        0,
        ...createdEvents.map((event) => event.newVersion)
      );

      return {
        data: updatedAgreement,
        metadata: { version: newVersion },
      };
    },
    async archiveAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Agreement> {
      logger.info(`Archiving agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementArchivableStates
      );

      const activeConsumerDelegation =
        await readModelService.getActiveConsumerDelegationByAgreement(
          agreement.data
        );
      assertRequesterCanActAsConsumer(
        agreement.data,
        authData,
        activeConsumerDelegation
      );

      const updatedAgreement: Agreement = {
        ...agreement.data,
        state: agreementState.archived,
        stamps: {
          ...agreement.data.stamps,
          archiving: createStamp(authData, {
            consumerDelegation: activeConsumerDelegation,
            producerDelegation: undefined,
          }),
        },
      };

      await repository.createEvent(
        toCreateEventAgreementArchivedByConsumer(
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      );

      return updatedAgreement;
    },
    async internalArchiveAgreementAfterDelegationRevocation(
      agreementId: AgreementId,
      delegationId: DelegationId,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Archiving agreement ${agreementId} due to revocation of delegation ${delegationId}`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementArchivableStates
      );

      const updatedAgreement: Agreement = {
        ...agreement.data,
        state: agreementState.archived,
      };

      await repository.createEvent(
        toCreateEventAgreementArchivedByRevokedDelegation(
          updatedAgreement,
          delegationId,
          agreement.metadata.version,
          correlationId
        )
      );
    },
    async internalComputeAgreementsStateByAttribute(
      attributeId: AttributeId,
      consumer: CompactTenant,
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Recalculating agreements state for Attribute ${attributeId} - Consumer Tenant ${consumer.id}`
      );

      const events = await computeAgreementsStateByAttribute(
        attributeId,
        consumer,
        readModelService,
        correlationId,
        logger
      );

      for (const event of events) {
        await repository.createEvent(event);
      }
    },
    async verifyTenantCertifiedAttributes(
      {
        tenantId,
        descriptorId,
        eserviceId,
      }: {
        tenantId: TenantId;
        descriptorId: DescriptorId;
        eserviceId: EServiceId;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<agreementApi.HasCertifiedAttributes> {
      logger.info(
        `Veryfing tenant ${tenantId} has required certified attributes for descriptor ${descriptorId} of eservice ${eserviceId}`
      );

      assertRequesterCanActAsConsumer(
        { consumerId: tenantId, eserviceId },
        authData,
        await readModelService.getActiveConsumerDelegationByAgreement({
          consumerId: tenantId,
          eserviceId,
        })
      );

      const consumer = await retrieveTenant(tenantId, readModelService);
      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);

      return {
        hasCertifiedAttributes:
          eservice.producerId === consumer.id || // in case the consumer is also the producer, we don't need to check the attributes
          certifiedAttributesSatisfied(
            descriptor.attributes,
            consumer.attributes
          ),
      };
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

export function getSuspensionFlags(
  agreementOwnership: Ownership,
  agreement: Agreement,
  authData: UIAuthData | M2MAdminAuthData,
  targetDestinationState: AgreementState,
  activeDelegations: ActiveDelegations
): {
  suspendedByConsumer: boolean | undefined;
  suspendedByProducer: boolean | undefined;
} {
  return match(agreementOwnership)
    .with(ownership.PRODUCER, () => ({
      suspendedByProducer: suspendedByProducerFlag(
        agreement,
        authData.organizationId,
        targetDestinationState,
        activeDelegations.producerDelegation?.delegateId
      ),
      suspendedByConsumer: agreement.suspendedByConsumer,
    }))
    .with(ownership.CONSUMER, () => ({
      suspendedByProducer: agreement.suspendedByProducer,
      suspendedByConsumer: suspendedByConsumerFlag(
        agreement,
        authData.organizationId,
        targetDestinationState,
        activeDelegations.consumerDelegation?.delegateId
      ),
    }))
    .with(ownership.SELF_CONSUMER, () => ({
      suspendedByConsumer: suspendedByConsumerFlag(
        agreement,
        authData.organizationId,
        targetDestinationState,
        activeDelegations.consumerDelegation?.delegateId
      ),
      suspendedByProducer: suspendedByProducerFlag(
        agreement,
        authData.organizationId,
        targetDestinationState,
        activeDelegations.producerDelegation?.delegateId
      ),
    }))
    .exhaustive();
}

export function getSuspensionStamps({
  agreementOwnership,
  agreement,
  newAgreementState,
  authData,
  stamp,
  activeDelegations,
}: {
  agreementOwnership: Ownership;
  agreement: Agreement;
  newAgreementState: AgreementState;
  authData: UIAuthData | M2MAdminAuthData;
  stamp: AgreementStamp;
  activeDelegations: ActiveDelegations;
}): {
  suspensionByConsumer: AgreementStamp | undefined;
  suspensionByProducer: AgreementStamp | undefined;
} {
  return match(agreementOwnership)
    .with(ownership.PRODUCER, () => ({
      suspensionByProducer: suspendedByProducerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.producerDelegation?.delegateId
      ),
      suspensionByConsumer: agreement.stamps.suspensionByConsumer,
    }))
    .with(ownership.CONSUMER, () => ({
      suspensionByProducer: agreement.stamps.suspensionByProducer,
      suspensionByConsumer: suspendedByConsumerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.consumerDelegation?.delegateId
      ),
    }))
    .with(ownership.SELF_CONSUMER, () => ({
      suspensionByConsumer: suspendedByConsumerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.consumerDelegation?.delegateId
      ),
      suspensionByProducer: suspendedByProducerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.producerDelegation?.delegateId
      ),
    }))
    .exhaustive();
}

export async function createAndCopyDocumentsForClonedAgreement(
  newAgreementId: AgreementId,
  clonedAgreement: Agreement,
  copyFile: FileManager["copy"],
  logger: Logger
): Promise<AgreementDocument[]> {
  const docs = await Promise.all(
    clonedAgreement.consumerDocuments.map(async (d) => {
      const newId: AgreementDocumentId = generateId();
      const documentDestinationPath = `${config.consumerDocumentsPath}/${newAgreementId}`;

      return {
        newId,
        newPath: await copyFile(
          config.s3Bucket,
          d.path,
          documentDestinationPath,
          newId,
          d.name,
          logger
        ),
      };
    })
  );

  return docs.map((d, i) => ({
    id: d.newId,
    name: clonedAgreement.consumerDocuments[i].name,
    prettyName: clonedAgreement.consumerDocuments[i].prettyName,
    contentType: clonedAgreement.consumerDocuments[i].contentType,
    path: d.newPath,
    createdAt: new Date(),
  }));
}

export function createAgreementArchivedByUpgradeEvent(
  agreement: WithMetadata<Agreement>,
  authData: UIAuthData | M2MAdminAuthData,
  activeDelegations: ActiveDelegations,
  correlationId: CorrelationId
): CreateEvent<AgreementEvent> {
  const updateSeed: UpdateAgreementSeed = {
    state: agreementState.archived,
    stamps: {
      ...agreement.data.stamps,
      archiving: createStamp(authData, activeDelegations),
    },
  };

  return toCreateEventAgreementArchivedByUpgrade(
    {
      ...agreement.data,
      ...updateSeed,
    },
    agreement.metadata.version,
    correlationId
  );
}

function maybeCreateSetToMissingCertifiedAttributesByPlatformEvent(
  agreement: WithMetadata<Agreement>,
  nextStateByAttributes: AgreementState,
  recalculatedSuspendedByPlatform: boolean,
  correlationId: CorrelationId
): CreateEvent<AgreementEvent> | undefined {
  if (
    nextStateByAttributes === agreementState.missingCertifiedAttributes &&
    recalculatedSuspendedByPlatform &&
    recalculatedSuspendedByPlatform !== agreement.data.suspendedByPlatform
  ) {
    /* In this case, it means that one of the certified attributes is not
      valid anymore. We put the agreement in the missingCertifiedAttributes state
      and fail the submission */
    const missingCertifiedAttributesByPlatformAgreement: Agreement = {
      ...agreement.data,
      state: agreementState.missingCertifiedAttributes,
      suspendedByPlatform: true,
    };

    return toCreateEventAgreementSetMissingCertifiedAttributesByPlatform(
      missingCertifiedAttributesByPlatformAgreement,
      agreement.metadata.version,
      correlationId
    );
  }
  return undefined;
}

// eslint-disable-next-line max-params
async function addContractOnFirstActivation(
  isFirstActivation: boolean,
  contractBuilder: ContractBuilder,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  agreement: Agreement,
  activeDelegations: ActiveDelegations
): Promise<Agreement> {
  if (isFirstActivation) {
    const contract = await contractBuilder.createContract(
      agreement,
      eservice,
      consumer,
      producer,
      activeDelegations
    );

    return {
      ...agreement,
      contract,
    };
  }

  return agreement;
}

async function getConsumerFromDelegationOrRequester(
  eserviceId: EServiceId,
  delegationId: DelegationId | undefined,
  authData: UIAuthData | M2MAdminAuthData,
  readModelService: ReadModelService
): Promise<Tenant> {
  const delegations =
    await readModelService.getActiveConsumerDelegationsByEserviceId(eserviceId);

  if (delegationId) {
    // If a delegation has been passed, the consumer is the delegator

    const delegation = delegations.find((d) => d.id === delegationId);

    if (!delegation) {
      throw delegationNotFound(delegationId);
    }

    assertRequesterIsDelegateConsumer(
      { consumerId: delegation.delegatorId, eserviceId },
      authData,
      delegation
    );
    return retrieveTenant(delegation.delegatorId, readModelService);
  } else {
    const delegation = delegations.find(
      (d) => d.delegatorId === authData.organizationId
    );

    if (delegation) {
      // If a delegation exists, the delegator cannot create the agreement
      throw tenantIsNotTheDelegateConsumer(
        authData.organizationId,
        delegation.id
      );
    }

    return retrieveTenant(authData.organizationId, readModelService);
  }
}
