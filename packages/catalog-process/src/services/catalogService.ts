import {
  AuthData,
  DB,
  FileManager,
  eventRepository,
  hasPermission,
  logger,
  userRoles,
} from "pagopa-interop-commons";
import {
  Descriptor,
  DescriptorId,
  DescriptorState,
  Document,
  EService,
  EServiceDocumentId,
  EServiceId,
  TenantId,
  WithMetadata,
  catalogEventToBinaryData,
  descriptorState,
  generateId,
  operationForbidden,
  unsafeBrandId,
  ListResult,
  AttributeId,
  agreementState,
  EserviceAttributes,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  Consumer,
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
  UpdateEServiceDescriptorQuotasSeed,
  EServiceAttributesSeed,
} from "../model/domain/models.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptorActivated,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorArchived,
  toCreateEventEServiceDescriptorDeleted,
  toCreateEventEServiceDescriptorPublished,
  toCreateEventEServiceDescriptorQuotasUpdated,
  toCreateEventEServiceDescriptorSuspended,
  toCreateEventEServiceDocumentAdded,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceDraftDescriptorUpdated,
  toCreateEventEServiceInterfaceAdded,
  toCreateEventEServiceInterfaceDeleted,
  toCreateEventEServiceInterfaceUpdated,
  toCreateEventEServiceUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
  ApiGetEServicesFilters,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import {
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  eServiceDuplicate,
  notValidDescriptor,
  eServiceNotFound,
  eServiceDescriptorWithoutInterface,
  interfaceAlreadyExists,
  attributeNotFound,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../model/domain/errors.js";
import { formatClonedEServiceDate } from "../utilities/date.js";
import { ReadModelService } from "./readModelService.js";

const assertRequesterAllowed = (
  producerId: TenantId,
  requesterId: TenantId
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<WithMetadata<EService>> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: WithMetadata<EService>
): Descriptor => {
  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eservice.data.id, descriptorId);
  }

  return descriptor;
};

const retrieveDocument = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  documentId: EServiceDocumentId
): Document => {
  const doc = descriptor.docs.find((d) => d.id === documentId);
  if (doc === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptor.id, documentId);
  }
  return doc;
};

const updateDescriptorState = (
  descriptor: Descriptor,
  newState: DescriptorState
): Descriptor => {
  const descriptorStateChange = [descriptor.state, newState];

  return match(descriptorStateChange)
    .with([descriptorState.draft, descriptorState.published], () => ({
      ...descriptor,
      state: newState,
      publishedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.suspended], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: new Date(),
    }))
    .with([descriptorState.suspended, descriptorState.published], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
    }))
    .with([descriptorState.suspended, descriptorState.deprecated], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
      deprecatedAt: new Date(),
    }))
    .with([descriptorState.suspended, descriptorState.archived], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
      archivedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.archived], () => ({
      ...descriptor,
      state: newState,
      archivedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.deprecated], () => ({
      ...descriptor,
      state: newState,
      deprecatedAt: new Date(),
    }))
    .otherwise(() => ({
      ...descriptor,
      state: newState,
    }));
};

const deprecateDescriptor = (
  eserviceId: EServiceId,
  descriptor: Descriptor
): Descriptor => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${eserviceId}`
  );

  return updateDescriptorState(descriptor, descriptorState.deprecated);
};

const archiveDescriptor = (
  streamId: string,
  descriptor: Descriptor
): Descriptor => {
  logger.info(`Archiving Descriptor ${descriptor.id} of EService ${streamId}`);

  return updateDescriptorState(descriptor, descriptorState.archived);
};

const hasNotDraftDescriptor = (eservice: EService): void => {
  const hasDraftDescriptor = eservice.descriptors.some(
    (d: Descriptor) => d.state === descriptorState.draft
  );
  if (hasDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eservice.id);
  }
};

const replaceDescriptor = (
  eservice: EService,
  newDescriptor: Descriptor
): EService => {
  const updatedDescriptors = eservice.descriptors.map((d: Descriptor) =>
    d.id === newDescriptor.id ? newDescriptor : d
  );

  return {
    ...eservice,
    descriptors: updatedDescriptors,
  };
};

async function parseAndCheckAttributes(
  attributesSeed: EServiceAttributesSeed,
  readModelService: ReadModelService
): Promise<EserviceAttributes> {
  const certifiedAttributes = attributesSeed.certified;
  const declaredAttributes = attributesSeed.declared;
  const verifiedAttributes = attributesSeed.verified;

  const attributesSeeds = [
    ...certifiedAttributes.flat(),
    ...declaredAttributes.flat(),
    ...verifiedAttributes.flat(),
  ];

  if (attributesSeeds.length > 0) {
    const attributesSeedsIds: AttributeId[] = attributesSeeds.map((attr) =>
      unsafeBrandId(attr.id)
    );
    const attributes = await readModelService.getAttributesByIds(
      attributesSeedsIds
    );
    const attributesIds = attributes.map((attr) => attr.id);
    for (const attributeSeedId of attributesSeedsIds) {
      if (!attributesIds.includes(unsafeBrandId(attributeSeedId))) {
        throw attributeNotFound(attributeSeedId);
      }
    }
  }

  return {
    certified: certifiedAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
    // eslint-disable-next-line sonarjs/no-identical-functions
    declared: declaredAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
    // eslint-disable-next-line sonarjs/no-identical-functions
    verified: verifiedAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, catalogEventToBinaryData);
  return {
    async getEServiceById(
      eserviceId: EServiceId,
      authData: AuthData
    ): Promise<EService> {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      return applyVisibilityToEService(eservice.data, authData);
    },

    async getEServices(
      authData: AuthData,
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<EService>> {
      logger.info(
        `Getting EServices with name = ${filters.name}, ids = ${filters.eservicesIds}, producers = ${filters.producersIds}, states = ${filters.states}, agreementStates = ${filters.agreementStates}, limit = ${limit}, offset = ${offset}`
      );
      const eservicesList = await readModelService.getEServices(
        authData,
        filters,
        offset,
        limit
      );

      const eservicesToReturn = eservicesList.results.map((eservice) =>
        applyVisibilityToEService(eservice, authData)
      );

      return {
        results: eservicesToReturn,
        totalCount: eservicesList.totalCount,
      };
    },

    async getEServiceConsumers(
      eserviceId: EServiceId,
      offset: number,
      limit: number
    ): Promise<ListResult<Consumer>> {
      logger.info(`Retrieving consumers for EService ${eserviceId}`);
      return await readModelService.getEServiceConsumers(
        eserviceId,
        offset,
        limit
      );
    },

    async getDocumentById({
      eserviceId,
      descriptorId,
      documentId,
      authData,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      documentId: EServiceDocumentId;
      authData: AuthData;
    }): Promise<Document> {
      logger.info(
        `Retrieving EService document ${documentId} for EService ${eserviceId} and descriptor ${descriptorId}`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const document = retrieveDocument(eserviceId, descriptor, documentId);
      const checkedEService = applyVisibilityToEService(
        eservice.data,
        authData
      );
      if (!checkedEService.descriptors.find((d) => d.id === descriptorId)) {
        throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
      }
      return document;
    },

    async createEService(
      apiEServicesSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Creating EService with service name ${apiEServicesSeed.name}`
      );

      if (authData.externalId.origin !== "IPA") {
        throw originNotCompliant("IPA");
      }

      const eserviceWithSameName =
        await readModelService.getEServiceByNameAndProducerId({
          name: apiEServicesSeed.name,
          producerId: authData.organizationId,
        });
      if (eserviceWithSameName) {
        throw eServiceDuplicate(apiEServicesSeed.name);
      }

      const newEService: EService = {
        id: generateId(),
        producerId: authData.organizationId,
        name: apiEServicesSeed.name,
        description: apiEServicesSeed.description,
        technology: apiTechnologyToTechnology(apiEServicesSeed.technology),
        mode: apiEServiceModeToEServiceMode(apiEServicesSeed.mode),
        attributes: undefined,
        descriptors: [],
        createdAt: new Date(),
        riskAnalysis: [],
      };

      const event = toCreateEventEServiceAdded(newEService);
      await repository.createEvent(event);

      return newEService;
    },

    async updateEService(
      eserviceId: EServiceId,
      eserviceSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      if (
        !(
          eservice.data.descriptors.length === 0 ||
          (eservice.data.descriptors.length === 1 &&
            eservice.data.descriptors[0].state === descriptorState.draft)
        )
      ) {
        throw eServiceCannotBeUpdated(eserviceId);
      }

      if (eserviceSeed.name !== eservice.data.name) {
        const eserviceWithSameName =
          await readModelService.getEServiceByNameAndProducerId({
            name: eserviceSeed.name,
            producerId: authData.organizationId,
          });
        if (eserviceWithSameName !== undefined) {
          throw eServiceDuplicate(eserviceSeed.name);
        }
      }

      const updatedTechnology = apiTechnologyToTechnology(
        eserviceSeed.technology
      );
      if (eservice.data.descriptors.length === 1) {
        const draftDescriptor = eservice.data.descriptors[0];
        if (
          updatedTechnology !== eservice.data.technology &&
          draftDescriptor.interface !== undefined
        ) {
          await fileManager
            .delete(config.s3Bucket, draftDescriptor.interface.path)
            .catch((error) => {
              logger.error(
                `Error deleting interface for descriptor ${draftDescriptor.id} : ${error}`
              );
              throw error;
            });
        }
      }

      const updatedEService: EService = {
        ...eservice.data,
        description: eserviceSeed.description,
        name: eserviceSeed.name,
        technology: updatedTechnology,
        producerId: authData.organizationId,
      };

      const event = toCreateEventEServiceUpdated(
        eserviceId,
        eservice.metadata.version,
        updatedEService
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async deleteEService(
      eserviceId: EServiceId,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Deleting EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      if (eservice.data.descriptors.length > 0) {
        throw eServiceCannotBeDeleted(eserviceId);
      }

      const event = toCreateEventEServiceDeleted(
        eserviceId,
        eservice.metadata.version,
        eservice.data
      );
      await repository.createEvent(event);
    },

    async uploadDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      document: ApiEServiceDescriptorDocumentSeed,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Creating EService Document ${document.documentId.toString} of kind ${document.kind}, name ${document.fileName}, path ${document.filePath} for EService ${eserviceId} and Descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptor(descriptor.id, descriptor.state);
      }

      if (document.kind === "INTERFACE" && descriptor.interface !== undefined) {
        throw interfaceAlreadyExists(descriptor.id);
      }

      const isInterface = document.kind === "INTERFACE";
      const newDocument: Document = {
        id: unsafeBrandId(document.documentId),
        name: document.fileName,
        contentType: document.contentType,
        prettyName: document.prettyName,
        path: document.filePath,
        checksum: document.checksum,
        uploadDate: new Date(),
      };

      const updatedEService: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface: isInterface ? newDocument : d.interface,
                docs: isInterface ? d.docs : [...d.docs, newDocument],
                serverUrls: document.serverUrls,
              }
            : d
        ),
      };

      const event =
        document.kind === "INTERFACE"
          ? toCreateEventEServiceInterfaceAdded(
              eserviceId,
              eservice.metadata.version,
              {
                descriptorId,
                documentId: unsafeBrandId(document.documentId),
                eservice: updatedEService,
              }
            )
          : toCreateEventEServiceDocumentAdded(
              eserviceId,
              eservice.metadata.version,
              {
                descriptorId,
                documentId: unsafeBrandId(document.documentId),
                eservice: updatedEService,
              }
            );

      await repository.createEvent(event);

      return updatedEService;
    },

    async deleteDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptor(descriptor.id, descriptor.state);
      }

      const document = [...descriptor.docs, descriptor.interface].find(
        (doc) => doc != null && doc.id === documentId
      );
      if (document === undefined) {
        throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
      }

      await fileManager
        .delete(config.s3Bucket, document.path)
        .catch((error) => {
          logger.error(
            `Error deleting interface or document file for descriptor ${descriptorId} : ${error}`
          );
          throw error;
        });

      const isInterface = document.id === descriptor?.interface?.id;
      const newEservice: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface:
                  d.interface?.id === documentId ? undefined : d.interface,
                docs: d.docs.filter((doc) => doc.id !== documentId),
              }
            : d
        ),
      };

      const event = isInterface
        ? toCreateEventEServiceInterfaceDeleted(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            }
          )
        : toCreateEventEServiceDocumentDeleted(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            }
          );

      await repository.createEvent(event);
    },

    async updateDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Updating Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptor(descriptor.id, descriptor.state);
      }

      const document = (
        descriptor ? [...descriptor.docs, descriptor.interface] : []
      ).find((doc) => doc != null && doc.id === documentId);

      if (document === undefined) {
        throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
      }

      const updatedDocument = {
        ...document,
        prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
      };

      const isInterface = document.id === descriptor?.interface?.id;
      const newEservice: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface: isInterface ? updatedDocument : d.interface,
                docs: d.docs.map((doc) =>
                  doc.id === documentId ? updatedDocument : doc
                ),
              }
            : d
        ),
      };

      const event = isInterface
        ? toCreateEventEServiceInterfaceUpdated(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            }
          )
        : toCreateEventEServiceDocumentUpdated(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            }
          );

      await repository.createEvent(event);
    },

    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: EServiceDescriptorSeed,
      authData: AuthData
    ): Promise<Descriptor> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);
      hasNotDraftDescriptor(eservice.data);

      const newVersion = nextDescriptorVersion(eservice.data);

      const parsedAttributes = await parseAndCheckAttributes(
        eserviceDescriptorSeed.attributes,
        readModelService
      );

      if (
        eserviceDescriptorSeed.dailyCallsPerConsumer >
        eserviceDescriptorSeed.dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const descriptorId = generateId<DescriptorId>();

      const newDescriptor: Descriptor = {
        id: descriptorId,
        description: eserviceDescriptorSeed.description,
        version: newVersion,
        interface: undefined,
        docs: [],
        state: "Draft",
        voucherLifespan: eserviceDescriptorSeed.voucherLifespan,
        audience: eserviceDescriptorSeed.audience,
        dailyCallsPerConsumer: eserviceDescriptorSeed.dailyCallsPerConsumer,
        dailyCallsTotal: eserviceDescriptorSeed.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            eserviceDescriptorSeed.agreementApprovalPolicy
          ),
        serverUrls: [],
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        archivedAt: undefined,
        createdAt: new Date(),
        attributes: parsedAttributes,
      };

      const newEservice: EService = {
        ...eservice.data,
        descriptors: [...eservice.data.descriptors, newDescriptor],
      };

      const event = toCreateEventEServiceDescriptorAdded(
        eservice.data.id,
        eservice.metadata.version,
        descriptorId,
        newEservice
      );
      await repository.createEvent(event);

      return newDescriptor;
    },

    async deleteDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      const descriptorInterface = descriptor.interface;
      if (descriptorInterface !== undefined) {
        await fileManager
          .delete(config.s3Bucket, descriptorInterface.path)
          .catch((error) => {
            logger.error(
              `Error deleting interface file for descriptor ${descriptorId} : ${error}`
            );
            throw error;
          });
      }

      const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
        fileManager.delete(config.s3Bucket, doc.path)
      );

      await Promise.all(deleteDescriptorDocs).catch((error) => {
        logger.error(
          `Error deleting documents' files for descriptor ${descriptorId} : ${error}`
        );
        throw error;
      });

      const newEservice: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.filter(
          (d: Descriptor) => d.id !== descriptorId
        ),
      };

      const event = toCreateEventEServiceDescriptorDeleted(
        eservice.data.id,
        eservice.metadata.version,
        newEservice,
        descriptorId
      );

      await repository.createEvent(event);
    },

    async updateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorSeed,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptor(descriptorId, descriptor.state.toString());
      }

      if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
        throw inconsistentDailyCalls();
      }

      const parsedAttributes = await parseAndCheckAttributes(
        seed.attributes,
        readModelService
      );

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        description: seed.description,
        audience: seed.audience,
        voucherLifespan: seed.voucherLifespan,
        dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
        state: "Draft",
        dailyCallsTotal: seed.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.agreementApprovalPolicy
          ),
        attributes: parsedAttributes,
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      const event = toCreateEventEServiceDraftDescriptorUpdated(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        updatedEService
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async publishDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Publishing Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptor(descriptor.id, descriptor.state.toString());
      }

      if (descriptor.interface === undefined) {
        throw eServiceDescriptorWithoutInterface(descriptor.id);
      }

      const currentActiveDescriptor = eservice.data.descriptors.find(
        (d: Descriptor) => d.state === descriptorState.published
      );

      const publishedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.published
      );

      const eserviceWithPublishedDescriptor = replaceDescriptor(
        eservice.data,
        publishedDescriptor
      );

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const event = async () => {
        if (currentActiveDescriptor !== undefined) {
          const agreements = await readModelService.listAgreements(
            [eserviceId],
            [],
            [],
            [agreementState.active, agreementState.suspended],
            currentActiveDescriptor.id
          );
          if (agreements.length === 0) {
            const eserviceWithArchivedAndPublishedDescriptors =
              replaceDescriptor(
                eserviceWithPublishedDescriptor,
                archiveDescriptor(eserviceId, currentActiveDescriptor)
              );

            return toCreateEventEServiceDescriptorPublished(
              eserviceId,
              eservice.metadata.version,
              descriptorId,
              eserviceWithArchivedAndPublishedDescriptors
            );
          } else {
            const eserviceWithDeprecatedAndPublishedDescriptors =
              replaceDescriptor(
                eserviceWithPublishedDescriptor,
                deprecateDescriptor(eserviceId, currentActiveDescriptor)
              );

            return toCreateEventEServiceDescriptorPublished(
              eserviceId,
              eservice.metadata.version,
              descriptorId,
              eserviceWithDeprecatedAndPublishedDescriptors
            );
          }
        } else {
          return toCreateEventEServiceDescriptorPublished(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            eserviceWithPublishedDescriptor
          );
        }
      };
      await repository.createEvent(await event());
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Suspending Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (
        descriptor.state !== descriptorState.deprecated &&
        descriptor.state !== descriptorState.published
      ) {
        throw notValidDescriptor(descriptorId, descriptor.state.toString());
      }

      const updatedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.suspended
      );

      const newEservice = replaceDescriptor(eservice.data, updatedDescriptor);

      const event = toCreateEventEServiceDescriptorSuspended(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        newEservice
      );
      await repository.createEvent(event);
    },

    async activateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Activating descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (descriptor.state !== descriptorState.suspended) {
        throw notValidDescriptor(descriptorId, descriptor.state.toString());
      }

      const updatedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.published
      );
      const descriptorVersions: number[] = eservice.data.descriptors
        .filter(
          (d: Descriptor) =>
            d.state === descriptorState.suspended ||
            d.state === descriptorState.deprecated ||
            d.state === descriptorState.published
        )
        .map((d: Descriptor) => parseInt(d.version, 10));
      const recentDescriptorVersion = Math.max(...descriptorVersions);

      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      const event = () => {
        if (
          recentDescriptorVersion !== null &&
          parseInt(descriptor.version, 10) === recentDescriptorVersion
        ) {
          const newEservice = replaceDescriptor(
            eservice.data,
            updatedDescriptor
          );

          return toCreateEventEServiceDescriptorActivated(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            newEservice
          );
        } else {
          const newEservice = replaceDescriptor(
            eservice.data,
            deprecateDescriptor(eserviceId, descriptor)
          );

          return toCreateEventEServiceDescriptorActivated(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            newEservice
          );
        }
      };

      await repository.createEvent(event());
    },

    async cloneDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const clonedEServiceName = `${
        eservice.data.name
      } - clone - ${formatClonedEServiceDate(new Date())}`;

      if (
        await readModelService.getEServiceByNameAndProducerId({
          name: clonedEServiceName,
          producerId: authData.organizationId,
        })
      ) {
        throw eServiceDuplicate(clonedEServiceName);
      }

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      const clonedInterfaceId = generateId<EServiceDocumentId>();
      const clonedInterfacePath =
        descriptor.interface !== undefined
          ? await fileManager
              .copy(
                config.s3Bucket,
                descriptor.interface.path,
                config.eserviceDocumentsPath,
                clonedInterfaceId,
                descriptor.interface.name
              )
              .catch((error) => {
                logger.error(
                  `Error copying interface file for descriptor ${descriptorId} : ${error}`
                );
                throw error;
              })
          : undefined;

      const clonedInterfaceDocument: Document | undefined =
        descriptor.interface !== undefined && clonedInterfacePath !== undefined
          ? {
              id: clonedInterfaceId,
              name: descriptor.interface.name,
              contentType: descriptor.interface.contentType,
              prettyName: descriptor.interface.prettyName,
              path: clonedInterfacePath,
              checksum: descriptor.interface.checksum,
              uploadDate: new Date(),
            }
          : undefined;

      const clonedDocuments = await Promise.all(
        descriptor.docs.map(async (doc: Document) => {
          const clonedDocumentId = generateId<EServiceDocumentId>();
          const clonedDocumentPath = await fileManager.copy(
            config.s3Bucket,
            doc.path,
            config.eserviceDocumentsPath,
            clonedDocumentId,
            doc.name
          );
          const clonedDocument: Document = {
            id: clonedDocumentId,
            name: doc.name,
            contentType: doc.contentType,
            prettyName: doc.prettyName,
            path: clonedDocumentPath,
            checksum: doc.checksum,
            uploadDate: new Date(),
          };
          return clonedDocument;
        })
      ).catch((error) => {
        logger.error(
          `Error copying documents' files for descriptor ${descriptorId} : ${error}`
        );
        throw error;
      });

      const clonedEservice: EService = {
        id: generateId(),
        producerId: eservice.data.producerId,
        name: clonedEServiceName,
        description: eservice.data.description,
        technology: eservice.data.technology,
        attributes: eservice.data.attributes,
        createdAt: new Date(),
        riskAnalysis: eservice.data.riskAnalysis,
        mode: eservice.data.mode,
        descriptors: [
          {
            ...descriptor,
            id: generateId(),
            version: "1",
            interface: clonedInterfaceDocument,
            docs: clonedDocuments,
            state: descriptorState.draft,
            createdAt: new Date(),
            publishedAt: undefined,
            suspendedAt: undefined,
            deprecatedAt: undefined,
            archivedAt: undefined,
          },
        ],
      };
      const event = toCreateEventClonedEServiceAdded(
        descriptorId,
        eservice.data,
        clonedEservice
      );
      await repository.createEvent(event);

      return clonedEservice;
    },

    async archiveDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Archiving Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const updatedDescriptor = updateDescriptorState(
        descriptor,
        descriptorState.archived
      );

      const newEservice = replaceDescriptor(eservice.data, updatedDescriptor);

      const event = toCreateEventEServiceDescriptorArchived(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        newEservice
      );

      await repository.createEvent(event);
    },

    async updateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorQuotasSeed,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended &&
        descriptor.state !== descriptorState.deprecated
      ) {
        throw notValidDescriptor(descriptorId, descriptor.state.toString());
      }

      if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
        throw inconsistentDailyCalls();
      }

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        voucherLifespan: seed.voucherLifespan,
        dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
        dailyCallsTotal: seed.dailyCallsTotal,
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      const event = toCreateEventEServiceDescriptorQuotasUpdated(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        updatedEService
      );
      await repository.createEvent(event);

      return updatedEService;
    },
  };
}

const isUserAllowedToSeeDraft = (
  authData: AuthData,
  producerId: TenantId
): boolean =>
  hasPermission([userRoles.ADMIN_ROLE, userRoles.API_ROLE], authData) &&
  authData.organizationId === producerId;

const applyVisibilityToEService = (
  eservice: EService,
  authData: AuthData
): EService => {
  if (isUserAllowedToSeeDraft(authData, eservice.producerId)) {
    return eservice;
  }

  if (
    eservice.descriptors.length === 0 ||
    (eservice.descriptors.length === 1 &&
      eservice.descriptors[0].state === descriptorState.draft)
  ) {
    throw eServiceNotFound(eservice.id);
  }

  return {
    ...eservice,
    descriptors: eservice.descriptors.filter(
      (d) => d.state !== descriptorState.draft
    ),
  };
};

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
