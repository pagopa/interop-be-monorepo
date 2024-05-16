import {
  DB,
  FileManager,
  Logger,
  WithLogger,
  AppContext,
  eventRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
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
} from "../model/domain/models.js";
import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementArchivedByConsumer,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementRejected,
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
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
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
import { processActivateAgreement } from "./agreementActivationProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { createStamp } from "./agreementStampUtils.js";
import { processSubmitAgreement } from "./agreementSubmissionProcessor.js";
import {
  createAgreementSuspendedEvent,
  createAgreementSuspended,
} from "./agreementSuspensionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import {
  AgreementEServicesQueryFilters,
  AgreementQueryFilters,
  ReadModelService,
} from "./readmodel/readModelService.js";

import { createUpgradeOrNewDraft } from "./agreementUpgradeProcessor.js";

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function agreementServiceBuilder(
  dbInstance: DB,
  agreementQuery: AgreementQuery,
  readModelService: ReadModelService,
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

      const eservice = await retrieveEService(eserviceId, readModelService);

      const descriptor = validateCreationOnDescriptor(eservice, descriptorId);

      await verifyCreationConflictingAgreements(
        authData.organizationId,
        agreementPayload,
        agreementQuery
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

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        readModelService
      );

      const [submittedAgreement, updatesEvents] = await processSubmitAgreement({
        agreementData: agreement,
        eservice,
        payload,
        agreementQuery,
        readModelService,
        contractBuilder: contractBuilder(
          authData.selfcareId,
          attributeQuery,
          fileManager.storeBytes,
          logger
        ),
        authData,
        correlationId,
      });

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }

      return submittedAgreement;
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
        descriptorId: newDescriptor.id,
        agreementQuery,
        canBeUpgraded: verifiedValid && declaredValid,
        copyFile: fileManager.copy,
        authData,
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

      const document = agreement.data.consumerDocuments.find(
        (d) => d.id === documentId
      );

      if (!document) {
        throw agreementDocumentNotFound(documentId, agreementId);
      }

      return document;
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

      const updatedAgreement: Agreement = createAgreementSuspended({
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

      const existentDocument = agreement.data.consumerDocuments.find(
        (d) => d.id === documentId
      );

      if (!existentDocument) {
        throw agreementDocumentNotFound(documentId, agreementId);
      }

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

      const stamp = createStamp(authData);
      const rejected: Agreement = {
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
          rejection: stamp,
        },
      };

      await repository.createEvent(
        toCreateEventAgreementRejected(
          rejected,
          agreementToBeRejected.metadata.version,
          correlationId
        )
      );
      return rejected;
    },
    async activateAgreement(
      agreementId: Agreement["id"],
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Agreement> {
      logger.info(`Activating agreement ${agreementId}`);

      const agreement = await retrieveAgreement(agreementId, agreementQuery);

      assertRequesterIsConsumerOrProducer(agreement.data, authData);
      verifyConsumerDoesNotActivatePending(agreement.data, authData);
      assertActivableState(agreement.data);

      const eservice = await retrieveEService(
        agreement.data.eserviceId,
        readModelService
      );

      const [updatedAgreement, updatesEvents] = await processActivateAgreement({
        agreementData: agreement,
        eservice,
        authData,
        readModelService,
        agreementQuery,
        attributeQuery,
        storeFile: fileManager.storeBytes,
        correlationId,
        logger,
      });

      for (const event of updatesEvents) {
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

      const updatedAgreement = {
        ...agreement.data,
        state: agreementState.archived,
        stamps: {
          ...agreement.data.stamps,
          archiving: createStamp(authData),
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
