import {
  AppContext,
  AuthData,
  CreateEvent,
  DB,
  FileManager,
  Logger,
  PDFGenerator,
  WithLogger,
  eventRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
  AgreementState,
  AttributeId,
  CompactTenant,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  ListResult,
  Tenant,
  TenantId,
  UserId,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  generateId,
  unsafeBrandId,
  CompactTenant,
} from "pagopa-interop-models";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  declaredAttributesSatisfied,
  verifiedAttributesSatisfied,
} from "pagopa-interop-lifecycle";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
  agreementSubmissionFailed,
  descriptorNotFound,
  eServiceNotFound,
  noNewerDescriptor,
  publishedDescriptorNotFound,
  tenantNotFound,
  unexpectedVersionFormat,
} from "../model/domain/errors.js";
import {
  CompactEService,
  CompactOrganization,
  UpdateAgreementSeed,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchivedByConsumer,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
  toCreateEventAgreementDeleted,
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
  assertCanWorkOnConsumerDocuments,
  assertExpectedState,
  assertRequesterIsConsumer,
  assertRequesterIsConsumerOrProducer,
  assertRequesterIsProducer,
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
  verifyConsumerDoesNotActivatePending,
  verifyCreationConflictingAgreements,
  verifySubmissionConflictingAgreements,
} from "../model/domain/agreement-validators.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
  agreementSubmissionFailed,
  descriptorNotFound,
  eServiceNotFound,
  noNewerDescriptor,
  publishedDescriptorNotFound,
  tenantNotFound,
  unexpectedVersionFormat,
} from "../model/domain/errors.js";
import {
  CompactEService,
  CompactOrganization,
  UpdateAgreementSeed,
} from "../model/domain/models.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchivedByConsumer,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementRejected,
  toCreateEventAgreementSetMissingCertifiedAttributesByPlatform,
  toCreateEventAgreementSubmitted,
  toCreateEventDraftAgreementUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiAgreementDocumentSeed,
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import {
  archiveRelatedToAgreements,
  createActivationEvent,
  createActivationUpdateAgreementSeed,
} from "./agreementActivationProcessor.js";
import {
  ContractBuilder,
  contractBuilder,
} from "./agreementContractBuilder.js";
import { createStamp } from "./agreementStampUtils.js";
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

const retrieveDescriptor = (
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function agreementServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager,
  pdfGenerator: PDFGenerator,
  selfcareV2Client: SelfcareV2Client
) {
  const repository = eventRepository(dbInstance, agreementEventToBinaryData);
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<Agreement>> {
      logger.info("Retrieving agreements");
      return await readModelService.getAgreements(filters, limit, offset);
    },
    async getAgreementById(
      agreementId: AgreementId,
      logger: Logger
    ): Promise<Agreement> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);
      return agreement.data;
    },
    async createAgreement(
      agreementPayload: ApiAgreementPayload,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(
        `Creating agreement for EService ${agreementPayload.eserviceId} and Descriptor ${agreementPayload.descriptorId}`
      );

      const eserviceId: EServiceId = unsafeBrandId<EServiceId>(
        agreementPayload.eserviceId
      );
      const descriptorId: DescriptorId = unsafeBrandId<DescriptorId>(
        agreementPayload.descriptorId
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      const descriptor = validateCreationOnDescriptor(eservice, descriptorId);

      await verifyCreationConflictingAgreements(
        authData.organizationId,
        agreementPayload,
        readModelService
      );
      const consumer = await retrieveTenant(
        authData.organizationId,
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
        consumerId: authData.organizationId,
        state: agreementState.draft,
        verifiedAttributes: [],
        certifiedAttributes: [],
        declaredAttributes: [],
        consumerDocuments: [],
        createdAt: new Date(),
        stamps: {},
      };

      await repository.createEvent(
        toCreateEventAgreementAdded(agreement, correlationId)
      );

      return agreement;
    },
    async getAgreementProducers(
      producerName: string | undefined,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving producers from agreements with producer name ${producerName}`
      );
      return await readModelService.getProducers(producerName, limit, offset);
    },
    async getAgreementConsumers(
      consumerName: string | undefined,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving consumers from agreements with consumer name ${consumerName}`
      );
      return await readModelService.getConsumers(consumerName, limit, offset);
    },
    async updateAgreement(
      agreementId: AgreementId,
      agreement: ApiAgreementUpdatePayload,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Updating agreement ${agreementId}`);
      const agreementToBeUpdated = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertRequesterIsConsumer(agreementToBeUpdated.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeUpdated.data.state,
        agreementUpdatableStates
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
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Deleting agreement ${agreementId}`);
      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertRequesterIsConsumer(agreement.data, authData);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementDeletableStates
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
    async submitAgreement(
      agreementId: AgreementId,
      payload: ApiAgreementSubmissionPayload,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Submitting agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertRequesterIsConsumer(agreement.data, authData);
      assertSubmittableState(agreement.data.state, agreement.data.id);
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
        authData.userId,
        suspendedByPlatform
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
        selfcareV2Client,
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
        updateSeed,
        updatedAgreement,
        authData
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
                authData.userId,
                correlationId
              )
            )
          : [];

      await repository.createEvents([
        agreementEvent,
        ...archivedAgreementsUpdates,
      ]);

      return submittedAgreement;
    },
    async upgradeAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Upgrading agreement ${agreementId}`);

      const agreementToBeUpgraded = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertRequesterIsConsumer(agreementToBeUpgraded.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeUpgraded.data.state,
        agreementUpgradableStates
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
        authData.organizationId,
        readModelService
      );

      if (eservice.producerId !== agreementToBeUpgraded.data.consumerId) {
        validateCertifiedAttributes({
          descriptor: newDescriptor,
          consumer,
        });
      }

      const verifiedValid = verifiedAttributesSatisfied(
        agreementToBeUpgraded.data.producerId,
        newDescriptor,
        consumer
      );

      const declaredValid = declaredAttributesSatisfied(
        newDescriptor,
        consumer
      );

      const [agreement, events] = await createUpgradeOrNewDraft({
        agreement: agreementToBeUpgraded,
        newDescriptor,
        eservice,
        consumer,
        readModelService,
        canBeUpgraded: verifiedValid && declaredValid,
        copyFile: fileManager.copy,
        userId: authData.userId,
        correlationId,
        logger,
      });

      await repository.createEvents(events);

      return agreement;
    },
    async cloneAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Cloning agreement ${agreementId}`);

      const agreementToBeCloned = await retrieveAgreement(
        agreementId,
        readModelService
      );
      assertRequesterIsConsumer(agreementToBeCloned.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeCloned.data.state,
        agreementClonableStates
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

      await repository.createEvent(
        toCreateEventAgreementAdded(newAgreement, correlationId)
      );

      return newAgreement;
    },
    async addConsumerDocument(
      agreementId: AgreementId,
      documentSeed: ApiAgreementDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<AgreementDocument> {
      logger.info(`Adding a consumer document to agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);
      assertRequesterIsConsumer(agreement.data, authData);
      assertCanWorkOnConsumerDocuments(agreement.data.state);

      const existentDocument = agreement.data.consumerDocuments.find(
        (d) => d.id === documentSeed.id
      );

      if (existentDocument) {
        throw agreementDocumentAlreadyExists(agreementId);
      }
      const newDocument = apiAgreementDocumentToAgreementDocument(documentSeed);

      const updatedAgreement = {
        ...agreement.data,
        consumerDocuments: [...agreement.data.consumerDocuments, newDocument],
      };

      await repository.createEvent(
        toCreateEventAgreementConsumerDocumentAdded(
          newDocument.id,
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      );

      return newDocument;
    },
    async getAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { authData, logger }: WithLogger<AppContext>
    ): Promise<AgreementDocument> {
      logger.info(
        `Retrieving consumer document ${documentId} from agreement ${agreementId}`
      );
      const agreement = await retrieveAgreement(agreementId, readModelService);
      assertRequesterIsConsumerOrProducer(agreement.data, authData);

      return retrieveAgreementDocument(agreement.data, documentId);
    },
    async suspendAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Suspending agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertRequesterIsConsumerOrProducer(agreement.data, authData);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementSuspendableStates
      );

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        readModelService
      );

      const descriptor = retrieveDescriptor(
        agreement.data.descriptorId,
        eservice
      );

      const consumer = await retrieveTenant(
        agreement.data.consumerId,
        readModelService
      );

      const updatedAgreement: Agreement = createSuspensionUpdatedAgreement({
        agreement: agreement.data,
        authData,
        descriptor,
        consumer,
      });

      await repository.createEvent(
        createAgreementSuspendedEvent(
          authData.organizationId,
          correlationId,
          updatedAgreement,
          agreement
        )
      );

      return updatedAgreement;
    },
    async getAgreementEServices(
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number,
      logger: Logger
    ): Promise<ListResult<CompactEService>> {
      logger.info(
        `Retrieving EServices with consumers ${filters.consumerIds}, producers ${filters.producerIds}, states ${filters.agreeementStates}, offset ${offset}, limit ${limit} and name matching ${filters.eserviceName}`
      );

      return await readModelService.getAgreementsEServices(
        filters,
        limit,
        offset
      );
    },
    async removeAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<string> {
      logger.info(
        `Removing consumer document ${documentId} from agreement ${agreementId}`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);
      assertRequesterIsConsumer(agreement.data, authData);
      assertCanWorkOnConsumerDocuments(agreement.data.state);

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

      return await repository.createEvent(
        toCreateEventAgreementConsumerDocumentRemoved(
          documentId,
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        )
      );
    },
    async rejectAgreement(
      agreementId: AgreementId,
      rejectionReason: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Rejecting agreement ${agreementId}`);

      const agreementToBeRejected = await retrieveAgreement(
        agreementId,
        readModelService
      );

      assertRequesterIsProducer(agreementToBeRejected.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeRejected.data.state,
        agreementRejectableStates
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
          rejection: createStamp(authData.userId),
        },
      };

      await repository.createEvent(
        toCreateEventAgreementRejected(
          rejectedAgreement,
          agreementToBeRejected.metadata.version,
          correlationId
        )
      );
      return rejectedAgreement;
    },
    async activateAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Activating agreement ${agreementId}`);

      const contractBuilderInstance = contractBuilder(
        readModelService,
        pdfGenerator,
        fileManager,
        selfcareV2Client,
        config,
        logger
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      assertRequesterIsConsumerOrProducer(agreement.data, authData);
      verifyConsumerDoesNotActivatePending(agreement.data, authData);
      assertActivableState(agreement.data);

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        readModelService
      );

      const descriptor = validateActivationOnDescriptor(
        eservice,
        agreement.data.descriptorId
      );

      const consumer = await retrieveTenant(
        agreement.data.consumerId,
        readModelService
      );

      const producer = await retrieveTenant(
        agreement.data.producerId,
        readModelService
      );

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

      const suspendedByConsumer = suspendedByConsumerFlag(
        agreement.data,
        authData.organizationId,
        targetDestinationState
      );
      const suspendedByProducer = suspendedByProducerFlag(
        agreement.data,
        authData.organizationId,
        targetDestinationState
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
        updatedAgreementSeed,
        updatedAgreementWithoutContract,
        authData
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
        authData,
        correlationId
      );

      const archiveEvents = await archiveRelatedToAgreements(
        agreement.data,
        authData.userId,
        readModelService,
        correlationId
      );

      await repository.createEvents([...activationEvents, ...archiveEvents]);

      return updatedAgreement;
    },
    async archiveAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Archiving agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, readModelService);
      assertRequesterIsConsumer(agreement.data, authData);
      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementArchivableStates
      );

      const updatedAgreement: Agreement = {
        ...agreement.data,
        state: agreementState.archived,
        stamps: {
          ...agreement.data.stamps,
          archiving: createStamp(authData.userId),
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
    async computeAgreementsStateByAttribute(
      attributeId: AttributeId,
      consumer: CompactTenant,
      { logger, correlationId }: WithLogger<AppContext>
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
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

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
  userId: UserId,
  correlationId: string
): CreateEvent<AgreementEvent> {
  const updateSeed: UpdateAgreementSeed = {
    state: agreementState.archived,
    stamps: {
      ...agreement.data.stamps,
      archiving: createStamp(userId),
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
  correlationId: string
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
  updateSeed: UpdateAgreementSeed,
  agreement: Agreement,
  authData: AuthData
): Promise<Agreement> {
  if (isFirstActivation) {
    const contract = await contractBuilder.createContract(
      authData.selfcareId,
      agreement,
      eservice,
      consumer,
      producer,
      updateSeed
    );

    return {
      ...agreement,
      contract,
    };
  }

  return agreement;
}
