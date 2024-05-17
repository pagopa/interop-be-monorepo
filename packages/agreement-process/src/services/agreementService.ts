import {
  DB,
  FileManager,
  Logger,
  WithLogger,
  AppContext,
  eventRepository,
  CreateEvent,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  ListResult,
  SelfcareId,
  Tenant,
  TenantId,
  UserId,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";
import {
  agreementAlreadyExists,
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
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
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchivedByConsumer,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementRejected,
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
  declaredAttributesSatisfied,
  failOnActivationFailure,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  validateActiveOrPendingAgreement,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  validateSubmitOnDescriptor,
  verifiedAttributesSatisfied,
  verifyConsumerDoesNotActivatePending,
  verifyCreationConflictingAgreements,
  verifySubmissionConflictingAgreements,
} from "../model/domain/validators.js";
import {
  ApiAgreementDocumentSeed,
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  archiveRelatedToAgreements,
  createActivationEvent,
  createActivationUpdateAgreementSeed,
} from "./agreementActivationProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { createStamp } from "./agreementStampUtils.js";
import {
  createAgreementSuspendedEvent,
  createSuspensionUpdatedAgreement,
} from "./agreementSuspensionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import {
  AgreementEServicesQueryFilters,
  AgreementQueryFilters,
} from "./readmodel/readModelService.js";

import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { createUpgradeOrNewDraft } from "./agreementUpgradeProcessor.js";
import {
  nextState,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
  agreementStateByFlags,
} from "./agreementStateProcessor.js";
import {
  createSubmissionUpdateAgreementSeed,
  isActiveOrSuspended,
  validateConsumerEmail,
} from "./agreementSubmissionProcessor.js";

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: EserviceQuery
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

export const retrieveAgreement = async (
  agreementId: AgreementId,
  readModelService: AgreementQuery
): Promise<WithMetadata<Agreement>> => {
  const agreement = await readModelService.getAgreementById(agreementId);
  if (!agreement) {
    throw agreementNotFound(agreementId);
  }
  return agreement;
};

export const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: TenantQuery
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
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  eserviceQuery: EserviceQuery,
  attributeQuery: AttributeQuery,
  fileManager: FileManager
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
      return await agreementQuery.getAgreements(filters, limit, offset);
    },
    async getAgreementById(
      agreementId: AgreementId,
      logger: Logger
    ): Promise<Agreement> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, agreementQuery);
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

      const eservice = await retrieveEService(eserviceId, eserviceQuery);

      const descriptor = validateCreationOnDescriptor(eservice, descriptorId);

      await verifyCreationConflictingAgreements(
        authData.organizationId,
        agreementPayload,
        agreementQuery
      );
      const consumer = await retrieveTenant(
        authData.organizationId,
        tenantQuery
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
      return await agreementQuery.getProducers(producerName, limit, offset);
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
      return await agreementQuery.getConsumers(consumerName, limit, offset);
    },
    async updateAgreement(
      agreementId: AgreementId,
      agreement: ApiAgreementUpdatePayload,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Updating agreement ${agreementId}`);
      const agreementToBeUpdated = await retrieveAgreement(
        agreementId,
        agreementQuery
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
    },
    async deleteAgreementById(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Deleting agreement ${agreementId}`);
      const agreement = await retrieveAgreement(agreementId, agreementQuery);

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

      const agreement = await retrieveAgreement(agreementId, agreementQuery);

      assertRequesterIsConsumer(agreement.data, authData);
      assertSubmittableState(agreement.data.state, agreement.data.id);
      await verifySubmissionConflictingAgreements(
        agreement.data,
        agreementQuery
      );

      if (agreement.data.state === agreementState.draft) {
        await validateConsumerEmail(agreement.data, tenantQuery);
      }

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        eserviceQuery
      );

      const descriptor = await validateSubmitOnDescriptor(
        eservice,
        agreement.data.descriptorId
      );

      const consumer = await retrieveTenant(
        agreement.data.consumerId,
        tenantQuery
      );

      const nextStateByAttributes = nextState(
        agreement.data,
        descriptor,
        consumer
      );

      const newState = agreementStateByFlags(
        nextStateByAttributes,
        undefined,
        undefined
      );

      validateActiveOrPendingAgreement(agreement.data.id, newState);

      const updateSeed = createSubmissionUpdateAgreementSeed(
        descriptor,
        consumer,
        eservice,
        agreement.data,
        payload,
        newState,
        false,
        authData.userId
      );

      const agreements = (
        await agreementQuery.getAllAgreements({
          producerId: agreement.data.producerId,
          consumerId: agreement.data.consumerId,
          eserviceId: agreement.data.eserviceId,
          agreementStates: [agreementState.active, agreementState.suspended],
        })
      ).filter((a: WithMetadata<Agreement>) => a.data.id !== agreement.data.id);

      const updatedAgreement = {
        ...agreement,
        ...updateSeed,
      };

      const submittedAgreement =
        updatedAgreement.state === agreementState.active &&
        agreements.length === 0
          ? {
              ...updatedAgreement,
              contract: await createContract({
                agreement: updatedAgreement.data,
                eservice,
                consumer,
                updateSeed,
                tenantQuery,
                attributeQuery,
                storeFile: fileManager.storeBytes,
                selfcareId: authData.selfcareId,
                logger,
              }),
            }
          : updatedAgreement;

      const submittedAgreementEvent = toCreateEventAgreementSubmitted(
        submittedAgreement.data,
        agreement.metadata.version,
        correlationId
      );

      const archivedAgreementsUpdates: Array<CreateEvent<AgreementEvent>> =
        isActiveOrSuspended(newState)
          ? agreements.map((agreement) =>
              createArchivedAgreementEvent(
                agreement,
                authData.userId,
                correlationId
              )
            )
          : [];

      for (const event of [
        submittedAgreementEvent,
        ...archivedAgreementsUpdates,
      ]) {
        await repository.createEvent(event);
      }

      return submittedAgreement.data;
    },
    async upgradeAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Upgrading agreement ${agreementId}`);

      const agreementToBeUpgraded = await retrieveAgreement(
        agreementId,
        agreementQuery
      );

      assertRequesterIsConsumer(agreementToBeUpgraded.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeUpgraded.data.state,
        agreementUpgradableStates
      );

      const eservice = await retrieveEService(
        agreementToBeUpgraded.data.eserviceId,
        eserviceQuery
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
        tenantQuery
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
        descriptorId: newDescriptor.id,
        agreementQuery,
        canBeUpgraded: verifiedValid && declaredValid,
        copyFile: fileManager.copy,
        userId: authData.userId,
        correlationId,
        logger,
      });

      for (const event of events) {
        await repository.createEvent(event);
      }

      return agreement;
    },
    async cloneAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Cloning agreement ${agreementId}`);

      const agreementToBeCloned = await retrieveAgreement(
        agreementId,
        agreementQuery
      );
      assertRequesterIsConsumer(agreementToBeCloned.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeCloned.data.state,
        agreementClonableStates
      );

      const activeAgreement = await agreementQuery.getAllAgreements({
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
        eserviceQuery
      );

      const descriptor = retrieveDescriptor(
        agreementToBeCloned.data.descriptorId,
        eservice
      );

      validateCertifiedAttributes({
        descriptor,
        consumer: await retrieveTenant(
          agreementToBeCloned.data.consumerId,
          tenantQuery
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

      const agreement = await retrieveAgreement(agreementId, agreementQuery);
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
      const agreement = await retrieveAgreement(agreementId, agreementQuery);
      assertRequesterIsConsumerOrProducer(agreement.data, authData);

      return retrieveAgreementDocument(agreement.data, documentId);
    },
    async suspendAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Suspending agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, agreementQuery);

      assertRequesterIsConsumerOrProducer(agreement.data, authData);

      assertExpectedState(
        agreementId,
        agreement.data.state,
        agreementSuspendableStates
      );

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        eserviceQuery
      );

      const descriptor = retrieveDescriptor(
        agreement.data.descriptorId,
        eservice
      );

      const consumer = await retrieveTenant(
        agreement.data.consumerId,
        tenantQuery
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

      return await agreementQuery.getEServices(filters, limit, offset);
    },
    async removeAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<string> {
      logger.info(
        `Removing consumer document ${documentId} from agreement ${agreementId}`
      );

      const agreement = await retrieveAgreement(agreementId, agreementQuery);
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
        agreementQuery
      );

      assertRequesterIsProducer(agreementToBeRejected.data, authData);

      assertExpectedState(
        agreementId,
        agreementToBeRejected.data.state,
        agreementRejectableStates
      );

      const eservice = await retrieveEService(
        agreementToBeRejected.data.eserviceId,
        eserviceQuery
      );

      const descriptor = retrieveDescriptor(
        agreementToBeRejected.data.descriptorId,
        eservice
      );

      const consumer = await retrieveTenant(
        agreementToBeRejected.data.consumerId,
        tenantQuery
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

      const agreement = await retrieveAgreement(agreementId, agreementQuery);

      assertRequesterIsConsumerOrProducer(agreement.data, authData);
      verifyConsumerDoesNotActivatePending(agreement.data, authData);
      assertActivableState(agreement.data);

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        eserviceQuery
      );

      const descriptor = validateActivationOnDescriptor(
        eservice,
        agreement.data.descriptorId
      );

      const consumer = await retrieveTenant(
        agreement.data.consumerId,
        tenantQuery
      );

      const nextAttributesState = nextState(
        agreement.data,
        descriptor,
        consumer
      );

      const suspendedByConsumer = suspendedByConsumerFlag(
        agreement.data,
        authData.organizationId,
        agreementState.active
      );
      const suspendedByProducer = suspendedByProducerFlag(
        agreement.data,
        authData.organizationId,
        agreementState.active
      );

      const newState = agreementStateByFlags(
        nextAttributesState,
        suspendedByProducer,
        suspendedByConsumer
      );

      failOnActivationFailure(newState, agreement.data);

      const firstActivation =
        agreement.data.state === agreementState.pending &&
        newState === agreementState.active;

      const updatedAgreementSeed: UpdateAgreementSeed =
        createActivationUpdateAgreementSeed({
          firstActivation,
          newState,
          descriptor,
          consumer,
          eservice,
          authData,
          agreement: agreement.data,
          suspendedByConsumer,
          suspendedByProducer,
        });

      const updatedAgreement: Agreement = {
        ...agreement.data,
        ...updatedAgreementSeed,
      };

      const activationEvent = await createActivationEvent({
        firstActivation,
        agreement,
        updatedAgreement,
        updatedAgreementSeed,
        eservice,
        consumer,
        authData,
        correlationId,
        attributeQuery,
        tenantQuery,
        storeFile: fileManager.storeBytes,
        logger,
      });

      const archiveEvents = await archiveRelatedToAgreements(
        agreement.data,
        authData.userId,
        agreementQuery,
        correlationId
      );

      for (const event of [activationEvent, ...archiveEvents]) {
        await repository.createEvent(event);
      }
      return updatedAgreement;
    },
    async archiveAgreement(
      agreementId: AgreementId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Archiving agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, agreementQuery);
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

export async function createContract({
  agreement,
  updateSeed,
  eservice,
  consumer,
  attributeQuery,
  tenantQuery,
  selfcareId,
  storeFile,
  logger,
}: {
  agreement: Agreement;
  updateSeed: UpdateAgreementSeed;
  eservice: EService;
  consumer: Tenant;
  attributeQuery: AttributeQuery;
  tenantQuery: TenantQuery;
  selfcareId: SelfcareId;
  storeFile: FileManager["storeBytes"];
  logger: Logger;
}): Promise<AgreementDocument> {
  const producer = await retrieveTenant(agreement.producerId, tenantQuery);

  const contract = await contractBuilder(
    selfcareId,
    attributeQuery,
    storeFile,
    logger
  ).createContract(agreement, eservice, consumer, producer, updateSeed);

  return apiAgreementDocumentToAgreementDocument(contract);
}

export function createArchivedAgreementEvent(
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
