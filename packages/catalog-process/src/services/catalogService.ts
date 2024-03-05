import {
  AuthData,
  CreateEvent,
  DB,
  FileManager,
  RiskAnalysisValidatedForm,
  eventRepository,
  hasPermission,
  logger,
  userRoles,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  Attribute,
  Descriptor,
  DescriptorId,
  DescriptorState,
  Document,
  EService,
  EServiceDocumentId,
  EServiceEvent,
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
  eserviceMode,
  Tenant,
  RiskAnalysis,
  TenantKind,
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
  EServiceRiskAnalysisSeed,
} from "../model/domain/models.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptorActivated,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorDeleted,
  toCreateEventEServiceDescriptorPublished,
  toCreateEventEServiceDescriptorSuspended,
  toCreateEventEServiceDocumentAdded,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceInterfaceAdded,
  toCreateEventEServiceInterfaceDeleted,
  toCreateEventEServiceInterfaceUpdated,
  toCreateEventEServiceRiskAnalysisAdded,
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
  dailyCallsCannotBeDecreased,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  tenantKindNotFound,
  tenantNotFound,
  riskAnalysisValidationFailed,
} from "../model/domain/errors.js";
import { formatClonedEServiceDate } from "../utilities/date.js";
import { ReadModelService } from "./readModelService.js";

function assertEServiceExist(
  eserviceId: EServiceId,
  eservice: WithMetadata<EService> | undefined
): asserts eservice is NonNullable<WithMetadata<EService>> {
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
}

const assertRequesterAllowed = (
  producerId: TenantId,
  requesterId: TenantId
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

function assertIsDraftEservice(eservice: EService): void {
  if (eservice.descriptors.some((d) => d.state !== descriptorState.draft)) {
    throw eserviceNotInDraftState(eservice.id);
  }
}

function assertIsReceiveEservice(eservice: EService): void {
  if (eservice.mode !== eserviceMode.receive) {
    throw eserviceNotInReceiveMode(eservice.id);
  }
}

function assertTenantExists(
  tenantId: TenantId,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
}

function assertTenantKindExists(
  tenantId: TenantId,
  tenantKind: Tenant["kind"] | undefined
): asserts tenantKind is NonNullable<Tenant["kind"]> {
  if (tenantKind === undefined) {
    throw tenantKindNotFound(tenantId);
  }
}

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

const hasNotDraftDescriptor = (eservice: EService): void => {
  const hasDraftDescriptor = eservice.descriptors.some(
    (d: Descriptor) => d.state === descriptorState.draft
  );
  if (hasDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eservice.id);
  }
};

const updateDescriptor = (
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, catalogEventToBinaryData);
  return {
    async createEService(
      apiEServicesSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<EServiceId> {
      logger.info(
        `Creating EService with service name ${apiEServicesSeed.name}`
      );

      const eserviceWithSameName =
        await readModelService.getEServiceByNameAndProducerId({
          name: apiEServicesSeed.name,
          producerId: authData.organizationId,
        });
      return unsafeBrandId<EServiceId>(
        await repository.createEvent(
          createEserviceLogic({
            eserviceWithSameName,
            apiEServicesSeed,
            authData,
          })
        )
      );
    },
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

    async updateEService(
      eserviceId: EServiceId,
      eserviceSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Updating EService ${eserviceId}`);
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await updateEserviceLogic({
          eservice,
          eserviceId,
          authData,
          eserviceSeed,
          getEServiceByNameAndProducerId:
            readModelService.getEServiceByNameAndProducerId,
          deleteFile: fileManager.delete,
        })
      );
    },

    async deleteEService(
      eserviceId: EServiceId,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Deleting EService ${eserviceId}`);
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        deleteEserviceLogic({ eserviceId, authData, eservice })
      );
    },

    async uploadDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      document: ApiEServiceDescriptorDocumentSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(
        `Creating EService Document ${document.documentId.toString} of kind ${document.kind}, name ${document.fileName}, path ${document.filePath} for EService ${eserviceId} and Descriptor ${descriptorId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        uploadDocumentLogic({
          eserviceId,
          descriptorId,
          document,
          authData,
          eservice,
        })
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
    async deleteDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await deleteDocumentLogic({
          eserviceId,
          descriptorId,
          documentId,
          authData,
          eservice,
          deleteFile: fileManager.delete,
        })
      );
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
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await updateDocumentLogic({
          eserviceId,
          descriptorId,
          documentId,
          apiEServiceDescriptorDocumentUpdateSeed,
          authData,
          eservice,
        })
      );
    },

    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: EServiceDescriptorSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eservice = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        await createDescriptorLogic({
          eserviceId,
          eserviceDescriptorSeed,
          authData,
          eservice,
          getAttributesByIds: readModelService.getAttributesByIds,
        })
      );
    },

    async deleteDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);
      await repository.createEvent(
        await deleteDraftDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          deleteFile: fileManager.delete,
          eservice,
        })
      );
    },

    async updateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        updateDraftDescriptorLogic({
          eserviceId,
          descriptorId,
          seed,
          authData,
          eservice,
        })
      );
    },

    async publishDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Publishing Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        publishDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Suspending Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        suspendDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },

    async activateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Activating descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        activateDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },

    async cloneDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      const { eservice: draftEService, event } = await cloneDescriptorLogic({
        eserviceId,
        descriptorId,
        authData,
        copyFile: fileManager.copy,
        eservice,
        getEServiceByNameAndProducerId:
          readModelService.getEServiceByNameAndProducerId,
      });

      await repository.createEvent(event);

      return draftEService;
    },

    async archiveDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Archiving Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        archiveDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },
    async updateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorQuotasSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        updateDescriptorLogic({
          eserviceId,
          descriptorId,
          seed,
          authData,
          eservice,
        })
      );
    },
    async createRiskAnalysis(
      eserviceId: EServiceId,
      eserviceRiskAnalysisSeed: EServiceRiskAnalysisSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Creating Risk Analysis for EService ${eserviceId}`);

      const eservice = await readModelService.getEServiceById(eserviceId);
      const tenant = await readModelService.getTenantById(
        authData.organizationId
      );

      return await repository.createEvent(
        createRiskAnalysisLogic({
          eserviceId,
          eserviceRiskAnalysisSeed,
          authData,
          eservice,
          tenant,
        })
      );
    },
  };
}

export function createEserviceLogic({
  eserviceWithSameName,
  apiEServicesSeed,
  authData,
}: {
  eserviceWithSameName: WithMetadata<EService> | undefined;
  apiEServicesSeed: ApiEServiceSeed;
  authData: AuthData;
}): CreateEvent<EServiceEvent> {
  if (authData.externalId.origin !== "IPA") {
    throw originNotCompliant("IPA");
  }

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

  return toCreateEventEServiceAdded(newEService);
}

export async function updateEserviceLogic({
  eservice,
  eserviceId,
  authData,
  eserviceSeed,
  getEServiceByNameAndProducerId,
  deleteFile,
}: {
  eservice: WithMetadata<EService> | undefined;
  eserviceId: EServiceId;
  authData: AuthData;
  eserviceSeed: ApiEServiceSeed;
  getEServiceByNameAndProducerId: ({
    name,
    producerId,
  }: {
    name: string;
    producerId: TenantId;
  }) => Promise<WithMetadata<EService> | undefined>;
  deleteFile: (container: string, path: string) => Promise<void>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
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
    const eserviceWithSameName = await getEServiceByNameAndProducerId({
      name: eserviceSeed.name,
      producerId: authData.organizationId,
    });
    if (eserviceWithSameName !== undefined) {
      throw eServiceDuplicate(eserviceSeed.name);
    }
  }

  const updatedTechnology = apiTechnologyToTechnology(eserviceSeed.technology);
  if (eservice.data.descriptors.length === 1) {
    const draftDescriptor = eservice.data.descriptors[0];
    if (
      updatedTechnology !== eservice.data.technology &&
      draftDescriptor.interface !== undefined
    ) {
      await deleteFile(config.s3Bucket, draftDescriptor.interface.path).catch(
        (error) => {
          logger.error(
            `Error deleting interface for descriptor ${draftDescriptor.id} : ${error}`
          );
          throw error;
        }
      );
    }
  }

  const updatedEService: EService = {
    ...eservice.data,
    description: eserviceSeed.description,
    name: eserviceSeed.name,
    technology: updatedTechnology,
    producerId: authData.organizationId,
  };

  return toCreateEventEServiceUpdated(
    eserviceId,
    eservice.metadata.version,
    updatedEService
  );
}

export function deleteEserviceLogic({
  eserviceId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  if (eservice.data.descriptors.length > 0) {
    throw eServiceCannotBeDeleted(eserviceId);
  }

  return toCreateEventEServiceDeleted(
    eserviceId,
    eservice.metadata.version,
    eservice.data
  );
}

export function uploadDocumentLogic({
  eserviceId,
  descriptorId,
  document,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  document: ApiEServiceDescriptorDocumentSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
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

  const newEservice: EService = {
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

  return document.kind === "INTERFACE"
    ? toCreateEventEServiceInterfaceAdded(
        eserviceId,
        eservice.metadata.version,
        {
          descriptorId,
          documentId: unsafeBrandId(document.documentId),
          eservice: newEservice,
        }
      )
    : toCreateEventEServiceDocumentAdded(
        eserviceId,
        eservice.metadata.version,
        {
          descriptorId,
          documentId: unsafeBrandId(document.documentId),
          eservice: newEservice,
        }
      );
}

export async function deleteDocumentLogic({
  eserviceId,
  descriptorId,
  documentId,
  authData,
  eservice,
  deleteFile,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
  deleteFile: (bucket: string, path: string) => Promise<void>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
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

  await deleteFile(config.s3Bucket, document.path).catch((error) => {
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
            interface: d.interface?.id === documentId ? undefined : d.interface,
            docs: d.docs.filter((doc) => doc.id !== documentId),
          }
        : d
    ),
  };

  return isInterface
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
}

export async function updateDocumentLogic({
  eserviceId,
  descriptorId,
  documentId,
  apiEServiceDescriptorDocumentUpdateSeed,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
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

  return isInterface
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
}

export async function createDescriptorLogic({
  eserviceId,
  eserviceDescriptorSeed,
  authData,
  eservice,
  getAttributesByIds,
}: {
  eserviceId: EServiceId;
  eserviceDescriptorSeed: EServiceDescriptorSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
  getAttributesByIds: (attributesIds: AttributeId[]) => Promise<Attribute[]>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);
  hasNotDraftDescriptor(eservice.data);

  const newVersion = nextDescriptorVersion(eservice.data);

  const certifiedAttributes = eserviceDescriptorSeed.attributes.certified;
  const declaredAttributes = eserviceDescriptorSeed.attributes.declared;
  const verifiedAttributes = eserviceDescriptorSeed.attributes.verified;

  const attributesSeeds = [
    ...certifiedAttributes.flat(),
    ...declaredAttributes.flat(),
    ...verifiedAttributes.flat(),
  ];

  if (attributesSeeds.length > 0) {
    const attributesSeedsIds: AttributeId[] = attributesSeeds.map((attr) =>
      unsafeBrandId(attr.id)
    );
    const attributes = await getAttributesByIds(attributesSeedsIds);
    const attributesIds = attributes.map((attr) => attr.id);
    for (const attributeSeedId of attributesSeedsIds) {
      if (!attributesIds.includes(unsafeBrandId(attributeSeedId))) {
        throw attributeNotFound(attributeSeedId);
      }
    }
  }

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
    attributes: {
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
    },
  };

  const newEservice: EService = {
    ...eservice.data,
    descriptors: [...eservice.data.descriptors, newDescriptor],
  };

  return toCreateEventEServiceDescriptorAdded(
    eservice.data.id,
    eservice.metadata.version,
    descriptorId,
    newEservice
  );
}

export async function deleteDraftDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  deleteFile,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  deleteFile: (bucket: string, path: string) => Promise<void>;
  eservice: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const descriptorInterface = descriptor.interface;
  if (descriptorInterface !== undefined) {
    await deleteFile(config.s3Bucket, descriptorInterface.path).catch(
      (error) => {
        logger.error(
          `Error deleting interface file for descriptor ${descriptorId} : ${error}`
        );
        throw error;
      }
    );
  }

  const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
    deleteFile(config.s3Bucket, doc.path)
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

  return toCreateEventEServiceDescriptorDeleted(
    eservice.data.id,
    eservice.metadata.version,
    newEservice,
    descriptorId
  );
}

export function updateDraftDescriptorLogic({
  eserviceId,
  descriptorId,
  seed,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  seed: UpdateEServiceDescriptorSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
    throw inconsistentDailyCalls();
  }

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
  };

  const updatedEService = replaceDescriptor(eservice.data, updatedDescriptor);

  return toCreateEventEServiceUpdated(
    eserviceId,
    eservice.metadata.version,
    updatedEService
  );
}

export function publishDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
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

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );

  const newEservice = updateDescriptor(eservice.data, updatedDescriptor);

  if (currentActiveDescriptor !== undefined) {
    const newEserviceWithDeprecation = updateDescriptor(
      eservice.data,
      deprecateDescriptor(eserviceId, currentActiveDescriptor)
    );

    return toCreateEventEServiceDescriptorPublished(
      eserviceId,
      eservice.metadata.version + 1,
      descriptorId,
      newEserviceWithDeprecation
    );
  } else {
    return toCreateEventEServiceDescriptorPublished(
      eserviceId,
      eservice.metadata.version,
      descriptorId,
      newEservice
    );
  }
}

export function suspendDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
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

  const newEservice = updateDescriptor(eservice.data, updatedDescriptor);

  return toCreateEventEServiceDescriptorSuspended(
    eserviceId,
    eservice.metadata.version,
    descriptorId,
    newEservice
  );
}

export function activateDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
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

  if (
    recentDescriptorVersion !== null &&
    parseInt(descriptor.version, 10) === recentDescriptorVersion
  ) {
    const newEservice = updateDescriptor(eservice.data, updatedDescriptor);

    return toCreateEventEServiceDescriptorActivated(
      eserviceId,
      eservice.metadata.version,
      descriptorId,
      newEservice
    );
  } else {
    const newEservice = updateDescriptor(
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
}

export async function cloneDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  copyFile,
  eservice,
  getEServiceByNameAndProducerId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  copyFile: (
    bucket: string,
    docPath: string,
    path: string,
    id: string,
    name: string
  ) => Promise<string>;
  eservice: WithMetadata<EService> | undefined;
  getEServiceByNameAndProducerId: ({
    name,
    producerId,
  }: {
    name: string;
    producerId: TenantId;
  }) => Promise<WithMetadata<EService> | undefined>;
}): Promise<{ eservice: EService; event: CreateEvent<EServiceEvent> }> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const clonedEServiceName = `${
    eservice.data.name
  } - clone - ${formatClonedEServiceDate(new Date())}`;

  if (
    await getEServiceByNameAndProducerId({
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
      ? await copyFile(
          config.s3Bucket,
          descriptor.interface.path,
          config.eserviceDocumentsPath,
          clonedInterfaceId,
          descriptor.interface.name
        ).catch((error) => {
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
      const clonedDocumentPath = await copyFile(
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

  return {
    eservice: clonedEservice,
    event: toCreateEventClonedEServiceAdded(
      descriptorId,
      eservice.data,
      clonedEservice
    ),
  };
}

export function archiveDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);
  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.archived
  );

  const newEservice = updateDescriptor(eservice.data, updatedDescriptor);

  return toCreateEventEServiceDescriptorActivated(
    eserviceId,
    eservice.metadata.version,
    descriptorId,
    newEservice
  );
}

export function updateDescriptorLogic({
  eserviceId,
  descriptorId,
  seed,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  seed: UpdateEServiceDescriptorQuotasSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  if (
    descriptor.state !== descriptorState.published &&
    descriptor.state !== descriptorState.suspended &&
    descriptor.state !== descriptorState.deprecated
  ) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  assertDailyCallsAreConsistentAndNotDecreased({
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    updatedDailyCallsPerConsumer: seed.dailyCallsPerConsumer,
    updatedDailyCallsTotal: seed.dailyCallsTotal,
  });

  const updatedDescriptor: Descriptor = {
    ...descriptor,
    voucherLifespan: seed.voucherLifespan,
    dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
    dailyCallsTotal: seed.dailyCallsTotal,
  };

  const updatedEService = replaceDescriptor(eservice.data, updatedDescriptor);

  return toCreateEventEServiceUpdated(
    eserviceId,
    eservice.metadata.version,
    updatedEService
  );
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

function assertDailyCallsAreConsistentAndNotDecreased({
  dailyCallsPerConsumer,
  dailyCallsTotal,
  updatedDailyCallsPerConsumer,
  updatedDailyCallsTotal,
}: {
  dailyCallsPerConsumer: number;
  dailyCallsTotal: number;
  updatedDailyCallsPerConsumer: number;
  updatedDailyCallsTotal: number;
}): void {
  if (updatedDailyCallsPerConsumer > updatedDailyCallsTotal) {
    throw inconsistentDailyCalls();
  }
  if (
    updatedDailyCallsPerConsumer < dailyCallsPerConsumer ||
    updatedDailyCallsTotal < dailyCallsTotal
  ) {
    throw dailyCallsCannotBeDecreased();
  }
}

function replaceDescriptor(
  eservice: EService,
  updatedDescriptor: Descriptor
): EService {
  return {
    ...eservice,
    descriptors: eservice.descriptors.map((descriptor) =>
      descriptor.id === updatedDescriptor.id ? updatedDescriptor : descriptor
    ),
  };
}

export function createRiskAnalysisLogic({
  eserviceId,
  eserviceRiskAnalysisSeed,
  authData,
  eservice,
  tenant,
}: {
  eserviceId: EServiceId;
  eserviceRiskAnalysisSeed: EServiceRiskAnalysisSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
  tenant: WithMetadata<Tenant> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);
  assertIsDraftEservice(eservice.data);
  assertIsReceiveEservice(eservice.data);
  assertTenantExists(authData.organizationId, tenant);
  assertTenantKindExists(authData.organizationId, tenant.data.kind);

  const validatedRiskAnalysisForm = validateRiskAnalysisOrThrow(
    eserviceRiskAnalysisSeed.riskAnalysisForm,
    true,
    tenant.data.kind
  );

  const newRiskAnalysis: RiskAnalysis = {
    name: eserviceRiskAnalysisSeed.name,
    id: generateId(),
    createdAt: new Date(),
    riskAnalysisForm: {
      id: generateId(),
      version: validatedRiskAnalysisForm.version,
      singleAnswers: validatedRiskAnalysisForm.singleAnswers.map(
        (singleAnswer) => ({
          id: generateId(),
          ...singleAnswer,
        })
      ),
      multiAnswers: validatedRiskAnalysisForm.multiAnswers.map(
        (multipleAnswer) => ({
          id: generateId(),
          ...multipleAnswer,
        })
      ),
    },
  };

  const newEservice: EService = {
    ...eservice.data,
    riskAnalysis: [...eservice.data.riskAnalysis, newRiskAnalysis],
  };

  return toCreateEventEServiceRiskAnalysisAdded(
    eservice.data.id,
    eservice.metadata.version,
    newRiskAnalysis.id,
    newEservice
  );
}

function validateRiskAnalysisOrThrow(
  riskAnalysisForm: EServiceRiskAnalysisSeed["riskAnalysisForm"],
  schemaOnly: boolean,
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(riskAnalysisForm, schemaOnly, tenantKind);

  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
