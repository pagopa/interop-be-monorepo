/* eslint-disable max-params */
import { randomUUID } from "crypto";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  FileManager,
  formatDateddMMyyyyHHmmss,
  hasPermission,
  interpolateOpenApiSpec,
  Logger,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  userRoles,
  verifyAndCreateDocument,
  WithLogger,
} from "pagopa-interop-commons";
import {
  agreementState,
  AttributeId,
  catalogEventToBinaryData,
  Delegation,
  delegationKind,
  delegationState,
  Descriptor,
  DescriptorId,
  DescriptorRejectionReason,
  DescriptorState,
  descriptorState,
  Document,
  EService,
  EServiceAttribute,
  EserviceAttributes,
  EServiceDocumentId,
  EServiceEvent,
  EServiceId,
  eserviceMode,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplateVersionRef,
  eserviceTemplateVersionState,
  generateId,
  ListResult,
  operationForbidden,
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  TenantId,
  tenantKind,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { config } from "../config/config.js";
import {
  agreementApprovalPolicyToApiAgreementApprovalPolicy,
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
  eServiceModeToApiEServiceMode,
  technologyToApiTechnology,
} from "../model/domain/apiConverter.js";
import {
  attributeNotFound,
  audienceCannotBeEmpty,
  descriptorAttributeGroupSupersetMissingInAttributesSeed,
  documentPrettyNameDuplicate,
  eServiceAlreadyUpgraded,
  eServiceDescriptorNotFound,
  eServiceDescriptorWithoutInterface,
  eServiceDocumentNotFound,
  eserviceInterfaceDataNotValid,
  eServiceNameDuplicate,
  eServiceNotAnInstance,
  eServiceNotFound,
  eServiceRiskAnalysisNotFound,
  eserviceTemplateInterfaceNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateWithoutPublishedVersion,
  eserviceWithoutValidDescriptors,
  inconsistentAttributesSeedGroupsCount,
  inconsistentDailyCalls,
  interfaceAlreadyExists,
  invalidEServiceFlags,
  notValidDescriptorState,
  originNotCompliant,
  riskAnalysisDuplicated,
  tenantNotFound,
  unchangedAttributes,
  receiveTemplateMissingTenantKindRiskAnalysis,
} from "../model/domain/errors.js";
import {
  ApiGetEServicesFilters,
  Consumer,
  EServiceTemplateReferences,
} from "../model/domain/models.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptionUpdated,
  toCreateEventEServiceDescriptionUpdatedByTemplateUpdate,
  toCreateEventEServiceDescriptorActivated,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorApprovedByDelegator,
  toCreateEventEServiceDescriptorArchived,
  toCreateEventEServiceDescriptorAttributesUpdated,
  toCreateEventEServiceDescriptorAttributesUpdatedByTemplateUpdate,
  toCreateEventEServiceDescriptorDocumentAddedByTemplateUpdate,
  toCreateEventEServiceDescriptorDocumentDeletedByTemplateUpdate,
  toCreateEventEServiceDescriptorDocumentUpdatedByTemplateUpdate,
  toCreateEventEServiceDescriptorPublished,
  toCreateEventEServiceDescriptorQuotasUpdated,
  toCreateEventEServiceDescriptorQuotasUpdatedByTemplateUpdate,
  toCreateEventEServiceDescriptorRejectedByDelegator,
  toCreateEventEServiceDescriptorSubmittedByDelegate,
  toCreateEventEServiceDescriptorSuspended,
  toCreateEventEServiceDocumentAdded,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceDraftDescriptorDeleted,
  toCreateEventEServiceDraftDescriptorUpdated,
  toCreateEventEServiceInterfaceAdded,
  toCreateEventEServiceInterfaceDeleted,
  toCreateEventEServiceInterfaceUpdated,
  toCreateEventEServiceIsClientAccessDelegableDisabled,
  toCreateEventEServiceIsClientAccessDelegableEnabled,
  toCreateEventEServiceIsConsumerDelegableDisabled,
  toCreateEventEServiceIsConsumerDelegableEnabled,
  toCreateEventEServiceNameUpdated,
  toCreateEventEServiceNameUpdatedByTemplateUpdate,
  toCreateEventEServiceRiskAnalysisAdded,
  toCreateEventEServiceRiskAnalysisDeleted,
  toCreateEventEServiceRiskAnalysisUpdated,
  toCreateEventEServiceUpdated,
} from "../model/domain/toEvent.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDocumentDeletableDescriptorState,
  assertEServiceNotTemplateInstance,
  assertHasNoDraftOrWaitingForApprovalDescriptor,
  assertInterfaceDeletableDescriptorState,
  assertIsDraftEservice,
  assertIsReceiveEservice,
  assertNoExistingProducerDelegationInActiveOrPendingState,
  assertNotDuplicatedEServiceName,
  assertRequesterIsDelegateProducerOrProducer,
  assertRequesterIsProducer,
  assertRiskAnalysisIsValidForPublication,
  assertTenantKindExists,
  descriptorStatesNotAllowingDocumentOperations,
  isActiveDescriptor,
  isDescriptorUpdatable,
  isNotActiveDescriptor,
  validateRiskAnalysisSchemaOrThrow,
  assertEServiceIsTemplateInstance,
} from "./validators.js";

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

const retrieveDescriptorFromEService = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};
const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: WithMetadata<EService>
): Descriptor => retrieveDescriptorFromEService(descriptorId, eservice.data);

const retrieveDocument = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  documentId: EServiceDocumentId
): Document => {
  const document = [...descriptor.docs, descriptor.interface].find(
    (doc) => doc != null && doc.id === documentId
  );
  if (document === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptor.id, documentId);
  }
  return document;
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

const retrieveRiskAnalysis = (
  riskAnalysisId: RiskAnalysisId,
  eservice: WithMetadata<EService>
): RiskAnalysis => {
  const riskAnalysis = eservice.data.riskAnalysis.find(
    (ra: RiskAnalysis) => ra.id === riskAnalysisId
  );

  if (riskAnalysis === undefined) {
    throw eServiceRiskAnalysisNotFound(eservice.data.id, riskAnalysisId);
  }

  return riskAnalysis;
};

const assertRequesterCanPublish = (
  producerDelegation: Delegation | undefined,
  eservice: EService,
  authData: AuthData
): void => {
  if (producerDelegation) {
    if (
      producerDelegation.kind !== delegationKind.delegatedProducer ||
      authData.organizationId !== producerDelegation.delegateId
    ) {
      throw operationForbidden;
    }
  } else {
    assertRequesterIsProducer(eservice.producerId, authData);
  }
};

const retrieveActiveProducerDelegation = async (
  eservice: EService,
  readModelService: ReadModelService
): Promise<Delegation | undefined> =>
  await readModelService.getLatestDelegation({
    eserviceId: eservice.id,
    kind: delegationKind.delegatedProducer,
    states: [delegationState.active],
  });

const retrieveEServiceTemplate = async (
  eserviceTemplateId: EServiceTemplateId,
  readModelService: ReadModelService
): Promise<EServiceTemplate> => {
  const eserviceTemplate = await readModelService.getEServiceTemplateById(
    eserviceTemplateId
  );
  if (eserviceTemplate === undefined) {
    throw eServiceTemplateNotFound(eserviceTemplateId);
  }
  return eserviceTemplate;
};

const retrieveEServicePublishedTemplateVersion = (
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): EServiceTemplateVersion => {
  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === eserviceTemplateVersionId
  );

  if (
    !eserviceTemplateVersion ||
    eserviceTemplateVersion.state !== eserviceTemplateVersionState.published
  ) {
    throw eServiceTemplateWithoutPublishedVersion(eserviceTemplate.id);
  }

  return eserviceTemplateVersion;
};

const getTemplateDataFromEservice = (
  eservice: EService,
  descriptor: Descriptor
): {
  eserviceTemplateId: EServiceTemplateId;
  eserviceTemplateVersionId: EServiceTemplateVersionId;
} => {
  const eserviceTemplateId = eservice.templateRef?.id;
  const eserviceTemplateVersionId = descriptor.templateVersionRef?.id;

  if (!eserviceTemplateId || !eserviceTemplateVersionId) {
    throw eServiceNotAnInstance(eservice.id);
  }

  return {
    eserviceTemplateId: unsafeBrandId(eserviceTemplateId),
    eserviceTemplateVersionId: unsafeBrandId(eserviceTemplateVersionId),
  };
};

const evaluateEServiceTemplateVersionRef = (
  templateVersionId: EServiceTemplateVersionId | undefined,
  documentSeed: catalogApi.CreateEServiceDescriptorDocumentSeed
): EServiceTemplateVersionRef | undefined => {
  if (!templateVersionId) {
    return undefined;
  }

  const templateRef = { id: templateVersionId };
  const isInterface = documentSeed.kind === "INTERFACE";

  const updateTemplateRef: EServiceTemplateVersionRef | undefined =
    isInterface && documentSeed.interfaceTemplateMetadata
      ? {
          ...templateRef,
          interfaceMetadata: {
            ...documentSeed.interfaceTemplateMetadata,
          },
        }
      : templateRef;

  return updateTemplateRef;
};

const updateDescriptorState = (
  descriptor: Descriptor,
  newState: DescriptorState
): Descriptor => {
  const descriptorStateChange = [descriptor.state, newState];

  return match(descriptorStateChange)
    .with(
      [descriptorState.draft, descriptorState.published],
      [descriptorState.waitingForApproval, descriptorState.published],
      () => ({
        ...descriptor,
        state: newState,
        publishedAt: new Date(),
      })
    )
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
  descriptor: Descriptor,
  logger: Logger
): Descriptor => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${eserviceId}`
  );

  return updateDescriptorState(descriptor, descriptorState.deprecated);
};

const archiveDescriptor = (
  streamId: string,
  descriptor: Descriptor,
  logger: Logger
): Descriptor => {
  logger.info(`Archiving Descriptor ${descriptor.id} of EService ${streamId}`);

  return updateDescriptorState(descriptor, descriptorState.archived);
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

const replaceRiskAnalysis = (
  eservice: EService,
  newRiskAnalysis: RiskAnalysis
): EService => {
  const updatedRiskAnalysis = eservice.riskAnalysis.map((ra: RiskAnalysis) =>
    ra.id === newRiskAnalysis.id ? newRiskAnalysis : ra
  );

  return {
    ...eservice,
    riskAnalysis: updatedRiskAnalysis,
  };
};

async function parseAndCheckAttributes(
  attributesSeed: catalogApi.AttributesSeed,
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

function isTenantInSignalHubWhitelist(
  organizationId: TenantId,
  isSignalubEnabled: boolean | undefined
): boolean | undefined {
  return config.signalhubWhitelistProducer?.includes(organizationId)
    ? isSignalubEnabled
    : false;
}

async function innerCreateEService(
  seed: {
    eServiceSeed: catalogApi.EServiceSeed;
    eServiceTemplateReferences: EServiceTemplateReferences | undefined;
    riskAnalysis: RiskAnalysis[] | undefined;
  },
  readModelService: ReadModelService,
  { authData, correlationId }: WithLogger<AppContext>
): Promise<{ eService: EService; events: Array<CreateEvent<EServiceEvent>> }> {
  if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
    throw originNotCompliant(authData.externalId.origin);
  }

  const eserviceWithSameName =
    await readModelService.getEServiceByNameAndProducerId({
      name: seed.eServiceSeed.name,
      producerId: authData.organizationId,
    });
  if (eserviceWithSameName) {
    throw eServiceNameDuplicate(seed.eServiceSeed.name);
  }

  const creationDate = new Date();
  const newEService: EService = {
    id: generateId(),
    producerId: authData.organizationId,
    name: seed.eServiceSeed.name,
    description: seed.eServiceSeed.description,
    technology: apiTechnologyToTechnology(seed.eServiceSeed.technology),
    mode: apiEServiceModeToEServiceMode(seed.eServiceSeed.mode),
    attributes: undefined,
    descriptors: [],
    createdAt: creationDate,
    riskAnalysis: seed.riskAnalysis ?? [],
    isSignalHubEnabled: config.featureFlagSignalhubWhitelist
      ? isTenantInSignalHubWhitelist(
          authData.organizationId,
          seed.eServiceSeed.isSignalHubEnabled
        )
      : seed.eServiceSeed.isSignalHubEnabled,
    isConsumerDelegable: seed.eServiceSeed.isConsumerDelegable,
    isClientAccessDelegable: match(seed.eServiceSeed.isConsumerDelegable)
      .with(P.nullish, () => undefined)
      .with(false, () => false)
      .with(true, () => seed.eServiceSeed.isClientAccessDelegable)
      .exhaustive(),
    templateRef: seed.eServiceTemplateReferences
      ? {
          id: seed.eServiceTemplateReferences.templateId,
          instanceLabel: seed.eServiceTemplateReferences.instanceLabel,
        }
      : undefined,
  };

  const eserviceCreationEvent = toCreateEventEServiceAdded(
    newEService,
    correlationId
  );

  if (
    seed.eServiceSeed.descriptor.dailyCallsPerConsumer >
    seed.eServiceSeed.descriptor.dailyCallsTotal
  ) {
    throw inconsistentDailyCalls();
  }

  const templateVersionId = seed.eServiceTemplateReferences?.templateVersionId;

  const draftDescriptor: Descriptor = {
    id: generateId(),
    description: seed.eServiceSeed.descriptor.description,
    version: "1",
    interface: undefined,
    docs: [],
    state: descriptorState.draft,
    voucherLifespan: seed.eServiceSeed.descriptor.voucherLifespan,
    audience: seed.eServiceSeed.descriptor.audience,
    dailyCallsPerConsumer: seed.eServiceSeed.descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: seed.eServiceSeed.descriptor.dailyCallsTotal,
    agreementApprovalPolicy:
      apiAgreementApprovalPolicyToAgreementApprovalPolicy(
        seed.eServiceSeed.descriptor.agreementApprovalPolicy
      ),
    serverUrls: [],
    publishedAt: undefined,
    suspendedAt: undefined,
    deprecatedAt: undefined,
    archivedAt: undefined,
    createdAt: creationDate,
    attributes: { certified: [], declared: [], verified: [] },
    rejectionReasons: undefined,
    templateVersionRef: templateVersionId
      ? { id: templateVersionId }
      : undefined,
  };

  const eserviceWithDescriptor: EService = {
    ...newEService,
    descriptors: [draftDescriptor],
  };

  const descriptorCreationEvent = toCreateEventEServiceDescriptorAdded(
    eserviceWithDescriptor,
    0,
    draftDescriptor.id,
    correlationId
  );

  return {
    eService: eserviceWithDescriptor,
    events: [eserviceCreationEvent, descriptorCreationEvent],
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function innerAddDocumentToEserviceEvent(
  eService: WithMetadata<EService>,
  descriptorId: DescriptorId,
  documentSeed: catalogApi.CreateEServiceDescriptorDocumentSeed,
  templateVersionId: EServiceTemplateVersionId | undefined,
  readModelService: ReadModelService,
  { authData, correlationId }: WithLogger<AppContext>
): Promise<{ eService: EService; event: CreateEvent<EServiceEvent> }> {
  await assertRequesterIsDelegateProducerOrProducer(
    eService.data.producerId,
    eService.data.id,
    authData,
    readModelService
  );

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (descriptorStatesNotAllowingDocumentOperations(descriptor)) {
    throw notValidDescriptorState(descriptor.id, descriptor.state);
  }

  if (documentSeed.kind === "INTERFACE" && descriptor.interface !== undefined) {
    throw interfaceAlreadyExists(descriptor.id);
  }

  if (
    documentSeed.kind === "DOCUMENT" &&
    descriptor.docs.some(
      (d) =>
        d.prettyName.toLowerCase() === documentSeed.prettyName.toLowerCase()
    )
  ) {
    throw documentPrettyNameDuplicate(documentSeed.prettyName, descriptor.id);
  }

  const isInterface = documentSeed.kind === "INTERFACE";
  const newDocument: Document = {
    id: unsafeBrandId(documentSeed.documentId),
    name: documentSeed.fileName,
    contentType: documentSeed.contentType,
    prettyName: documentSeed.prettyName,
    path: documentSeed.filePath,
    checksum: documentSeed.checksum,
    uploadDate: new Date(),
  };

  const templateVersionRef = evaluateEServiceTemplateVersionRef(
    templateVersionId,
    documentSeed
  );

  const updatedEService: EService = {
    ...eService.data,
    descriptors: eService.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId
        ? {
            ...d,
            templateVersionRef,
            interface: isInterface ? newDocument : d.interface,
            docs: isInterface ? d.docs : [...d.docs, newDocument],
            serverUrls: isInterface ? documentSeed.serverUrls : d.serverUrls,
          }
        : d
    ),
  };

  const event =
    documentSeed.kind === "INTERFACE"
      ? toCreateEventEServiceInterfaceAdded(
          eService.data.id,
          eService.metadata.version,
          {
            descriptorId,
            documentId: unsafeBrandId(documentSeed.documentId),
            eservice: updatedEService,
          },
          correlationId
        )
      : toCreateEventEServiceDocumentAdded(
          eService.metadata.version,
          {
            descriptorId,
            documentId: unsafeBrandId(documentSeed.documentId),
            eservice: updatedEService,
          },
          correlationId
        );

  return { eService: updatedEService, event };
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
      { authData, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      return await applyVisibilityToEService(
        eservice.data,
        authData,
        readModelService
      );
    },

    async getEServices(
      authData: AuthData,
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number,
      logger: Logger
    ): Promise<ListResult<EService>> {
      logger.info(
        `Getting EServices with name = ${filters.name}, ids = ${filters.eservicesIds}, producers = ${filters.producersIds}, states = ${filters.states}, agreementStates = ${filters.agreementStates}, mode = ${filters.mode}, isConsumerDelegable = ${filters.isConsumerDelegable}, limit = ${limit}, offset = ${offset}`
      );
      const eservicesList = await readModelService.getEServices(
        authData,
        filters,
        offset,
        limit
      );

      const eservicesToReturn = await Promise.all(
        eservicesList.results.map((eservice) =>
          applyVisibilityToEService(eservice, authData, readModelService)
        )
      );

      return {
        results: eservicesToReturn,
        totalCount: eservicesList.totalCount,
      };
    },

    async getEServiceConsumers(
      eserviceId: EServiceId,
      offset: number,
      limit: number,
      logger: Logger
    ): Promise<ListResult<Consumer>> {
      logger.info(`Retrieving consumers for EService ${eserviceId}`);
      return await readModelService.getEServiceConsumers(
        eserviceId,
        offset,
        limit
      );
    },

    async getDocumentById(
      {
        eserviceId,
        descriptorId,
        documentId,
      }: {
        eserviceId: EServiceId;
        descriptorId: DescriptorId;
        documentId: EServiceDocumentId;
      },
      { authData, logger }: WithLogger<AppContext>
    ): Promise<Document> {
      logger.info(
        `Retrieving EService document ${documentId} for EService ${eserviceId} and descriptor ${descriptorId}`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const document = retrieveDocument(eserviceId, descriptor, documentId);
      const checkedEService = await applyVisibilityToEService(
        eservice.data,
        authData,
        readModelService
      );
      if (!checkedEService.descriptors.find((d) => d.id === descriptorId)) {
        throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
      }
      return document;
    },

    async createEService(
      seed: catalogApi.EServiceSeed,
      ctx: WithLogger<AppContext>
    ): Promise<EService> {
      ctx.logger.info(`Creating EService with name ${seed.name}`);

      const { eService, events } = await innerCreateEService(
        {
          eServiceSeed: seed,
          eServiceTemplateReferences: undefined,
          riskAnalysis: undefined,
        },
        readModelService,
        ctx
      );

      await repository.createEvents(events);

      return eService;
    },

    async updateEService(
      eserviceId: EServiceId,
      eserviceSeed: catalogApi.UpdateEServiceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      assertIsDraftEservice(eservice.data);

      if (eserviceSeed.name !== eservice.data.name) {
        const eserviceWithSameName =
          await readModelService.getEServiceByNameAndProducerId({
            name: eserviceSeed.name,
            producerId: eservice.data.producerId,
          });
        if (eserviceWithSameName !== undefined) {
          throw eServiceNameDuplicate(eserviceSeed.name);
        }
      }

      const updatedTechnology = apiTechnologyToTechnology(
        eserviceSeed.technology
      );
      const interfaceHasToBeDeleted =
        updatedTechnology !== eservice.data.technology;

      if (interfaceHasToBeDeleted) {
        await Promise.all(
          eservice.data.descriptors.map(async (d) => {
            if (d.interface !== undefined) {
              return await fileManager.delete(
                config.s3Bucket,
                d.interface.path,
                logger
              );
            }
          })
        );
      }

      const updatedMode = apiEServiceModeToEServiceMode(eserviceSeed.mode);

      const checkedRiskAnalysis =
        updatedMode === eserviceMode.receive ? eservice.data.riskAnalysis : [];

      const updatedEService: EService = {
        ...eservice.data,
        description: eserviceSeed.description,
        name: eserviceSeed.name,
        technology: updatedTechnology,
        mode: updatedMode,
        riskAnalysis: checkedRiskAnalysis,
        descriptors: interfaceHasToBeDeleted
          ? eservice.data.descriptors.map((d) => ({
              ...d,
              interface: undefined,
              serverUrls: [],
            }))
          : eservice.data.descriptors,
        isSignalHubEnabled: config.featureFlagSignalhubWhitelist
          ? isTenantInSignalHubWhitelist(
              authData.organizationId,
              eservice.data.isSignalHubEnabled
            )
          : eservice.data.isSignalHubEnabled,
        isConsumerDelegable: eserviceSeed.isConsumerDelegable,
        isClientAccessDelegable: match(eserviceSeed.isConsumerDelegable)
          .with(P.nullish, () => undefined)
          .with(false, () => false)
          .with(true, () => eserviceSeed.isClientAccessDelegable)
          .exhaustive(),
      };

      const event = toCreateEventEServiceUpdated(
        eserviceId,
        eservice.metadata.version,
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async updateEServiceTemplateInstance(
      eserviceId: EServiceId,
      eserviceSeed: catalogApi.UpdateEServiceTemplateInstanceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId} template instance`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceIsTemplateInstance(eservice.data);

      const template = await retrieveEServiceTemplate(
        eservice.data.templateRef.id,
        readModelService
      );

      assertIsDraftEservice(eservice.data);

      const newName = `${template.name} ${
        eserviceSeed.instanceLabel ?? ""
      }`.trim();

      await assertNotDuplicatedEServiceName(
        newName,
        eservice.data,
        readModelService
      );

      const updatedEService: EService = {
        ...eservice.data,
        name: newName,
        templateRef: {
          id: eservice.data.templateRef.id,
          instanceLabel: eserviceSeed.instanceLabel,
        },
        isSignalHubEnabled: config.featureFlagSignalhubWhitelist
          ? isTenantInSignalHubWhitelist(
              authData.organizationId,
              eservice.data.isSignalHubEnabled
            )
          : eservice.data.isSignalHubEnabled,
        isConsumerDelegable: eserviceSeed.isConsumerDelegable,
        isClientAccessDelegable: match(eserviceSeed.isConsumerDelegable)
          .with(P.nullish, () => undefined)
          .with(false, () => false)
          .with(true, () => eserviceSeed.isClientAccessDelegable)
          .exhaustive(),
      };

      const event = toCreateEventEServiceUpdated(
        eserviceId,
        eservice.metadata.version,
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async deleteEService(
      eserviceId: EServiceId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Deleting EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);
      assertRequesterIsProducer(eservice.data.producerId, authData);
      assertIsDraftEservice(eservice.data);

      await assertNoExistingProducerDelegationInActiveOrPendingState(
        eserviceId,
        readModelService
      );

      if (eservice.data.descriptors.length === 0) {
        const eserviceDeletionEvent = toCreateEventEServiceDeleted(
          eservice.metadata.version,
          eservice.data,
          correlationId
        );
        await repository.createEvent(eserviceDeletionEvent);
      } else {
        await deleteDescriptorInterfaceAndDocs(
          eservice.data.descriptors[0],
          fileManager,
          logger
        );

        const eserviceWithoutDescriptors: EService = {
          ...eservice.data,
          descriptors: [],
        };
        const descriptorDeletionEvent =
          toCreateEventEServiceDraftDescriptorDeleted(
            eservice.metadata.version,
            eserviceWithoutDescriptors,
            eservice.data.descriptors[0].id,
            correlationId
          );
        const eserviceDeletionEvent = toCreateEventEServiceDeleted(
          eservice.metadata.version + 1,
          eserviceWithoutDescriptors,
          correlationId
        );
        await repository.createEvents([
          descriptorDeletionEvent,
          eserviceDeletionEvent,
        ]);
      }
    },

    async uploadDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      document: catalogApi.CreateEServiceDescriptorDocumentSeed,
      ctx: WithLogger<AppContext>
    ): Promise<EService> {
      ctx.logger.info(
        `Creating EService Document ${document.documentId.toString()} of kind ${
          document.kind
        }, name ${document.fileName}, path ${
          document.filePath
        } for EService ${eserviceId} and Descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      const { eService: updatedEService, event } =
        await innerAddDocumentToEserviceEvent(
          eservice,
          descriptorId,
          document,
          undefined,
          readModelService,
          ctx
        );

      await repository.createEvent(event);

      return updatedEService;
    },

    async deleteDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      const document = retrieveDocument(eserviceId, descriptor, documentId);
      const isInterface = document.id === descriptor?.interface?.id;

      if (isInterface) {
        assertInterfaceDeletableDescriptorState(descriptor);
      } else {
        assertDocumentDeletableDescriptorState(descriptor);
      }

      await fileManager.delete(config.s3Bucket, document.path, logger);

      const newEservice: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.map((d: Descriptor) =>
          d.id === descriptorId
            ? {
                ...d,
                interface:
                  d.interface?.id === documentId ? undefined : d.interface,
                serverUrls: isInterface ? [] : d.serverUrls,
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
            },
            correlationId
          )
        : toCreateEventEServiceDocumentDeleted(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            },
            correlationId
          );

      await repository.createEvent(event);
    },

    // eslint-disable-next-line max-params
    async updateDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: catalogApi.UpdateEServiceDescriptorDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Document> {
      logger.info(
        `Updating Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptorStatesNotAllowingDocumentOperations(descriptor)) {
        throw notValidDescriptorState(descriptor.id, descriptor.state);
      }

      const document = retrieveDocument(eserviceId, descriptor, documentId);

      if (
        descriptor.docs.some(
          (d) =>
            d.id !== documentId &&
            d.prettyName.toLowerCase() ===
              apiEServiceDescriptorDocumentUpdateSeed.prettyName.toLowerCase()
        )
      ) {
        throw documentPrettyNameDuplicate(
          apiEServiceDescriptorDocumentUpdateSeed.prettyName,
          descriptor.id
        );
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
            },
            correlationId
          )
        : toCreateEventEServiceDocumentUpdated(
            eserviceId,
            eservice.metadata.version,
            {
              descriptorId,
              documentId,
              eservice: newEservice,
            },
            correlationId
          );

      await repository.createEvent(event);
      return updatedDocument;
    },

    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: catalogApi.EServiceDescriptorSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Descriptor> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertHasNoDraftOrWaitingForApprovalDescriptor(eservice.data);

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

      const eserviceVersion = eservice.metadata.version;
      const newDescriptor: Descriptor = {
        id: descriptorId,
        description: eserviceDescriptorSeed.description,
        version: newVersion,
        interface: undefined,
        docs: [],
        state: descriptorState.draft,
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
        rejectionReasons: undefined,
      };

      const newEservice: EService = {
        ...eservice.data,
        descriptors: [...eservice.data.descriptors, newDescriptor],
      };

      const descriptorCreationEvent = toCreateEventEServiceDescriptorAdded(
        newEservice,
        eserviceVersion,
        descriptorId,
        correlationId
      );

      const { events, descriptorWithDocs } = eserviceDescriptorSeed.docs.reduce(
        (acc, document, index) => {
          const newDocument: Document = {
            id: unsafeBrandId(document.documentId),
            name: document.fileName,
            contentType: document.contentType,
            prettyName: document.prettyName,
            path: document.filePath,
            checksum: document.checksum,
            uploadDate: new Date(),
          };

          const descriptorWithDocs: Descriptor = {
            ...acc.descriptorWithDocs,
            docs: [...acc.descriptorWithDocs.docs, newDocument],
          };
          const updatedEService = replaceDescriptor(
            newEservice,
            descriptorWithDocs
          );
          const version = eserviceVersion + index + 1;
          const documentEvent = toCreateEventEServiceDocumentAdded(
            version,
            {
              descriptorId,
              documentId: unsafeBrandId(document.documentId),
              eservice: updatedEService,
            },
            correlationId
          );
          return {
            events: [...acc.events, documentEvent],
            descriptorWithDocs,
          };
        },
        {
          events: [descriptorCreationEvent],
          descriptorWithDocs: newDescriptor,
        }
      );

      await repository.createEvents(events);
      return descriptorWithDocs;
    },

    async deleteDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(descriptorId, descriptor.state);
      }

      await deleteDescriptorInterfaceAndDocs(descriptor, fileManager, logger);

      const eserviceAfterDescriptorDeletion: EService = {
        ...eservice.data,
        descriptors: eservice.data.descriptors.filter(
          (d: Descriptor) => d.id !== descriptorId
        ),
      };

      const descriptorDeletionEvent =
        toCreateEventEServiceDraftDescriptorDeleted(
          eservice.metadata.version,
          eserviceAfterDescriptorDeletion,
          descriptorId,
          correlationId
        );

      if (eserviceAfterDescriptorDeletion.descriptors.length === 0) {
        const eserviceDeletionEvent = toCreateEventEServiceDeleted(
          eservice.metadata.version + 1,
          eserviceAfterDescriptorDeletion,
          correlationId
        );
        await repository.createEvents([
          descriptorDeletionEvent,
          eserviceDeletionEvent,
        ]);
      } else {
        await repository.createEvent(descriptorDeletionEvent);
      }
    },

    async updateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
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
        state: descriptorState.draft,
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
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async updateDraftDescriptorTemplateInstance(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId} template instance`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceIsTemplateInstance(eservice.data);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
      }

      if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
        throw inconsistentDailyCalls();
      }

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        audience: seed.audience,
        dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
        state: descriptorState.draft,
        dailyCallsTotal: seed.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.agreementApprovalPolicy
          ),
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      const event = toCreateEventEServiceDraftDescriptorUpdated(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },

    async publishDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Publishing Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      const producerDelegation = await retrieveActiveProducerDelegation(
        eservice.data,
        readModelService
      );

      assertRequesterCanPublish(producerDelegation, eservice.data, authData);

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (descriptor.state !== descriptorState.draft) {
        throw notValidDescriptorState(
          descriptor.id,
          descriptor.state.toString()
        );
      }

      if (descriptor.interface === undefined) {
        throw eServiceDescriptorWithoutInterface(descriptor.id);
      }

      if (eservice.data.mode === eserviceMode.receive) {
        const tenant = await retrieveTenant(
          eservice.data.producerId,
          readModelService
        );
        assertTenantKindExists(tenant);
        assertRiskAnalysisIsValidForPublication(eservice.data, tenant.kind);
      }

      if (descriptor.audience.length === 0) {
        throw audienceCannotBeEmpty(descriptor.id);
      }

      if (producerDelegation) {
        const eserviceWithWaitingForApprovalDescriptor = replaceDescriptor(
          eservice.data,
          updateDescriptorState(descriptor, descriptorState.waitingForApproval)
        );
        await repository.createEvent(
          toCreateEventEServiceDescriptorSubmittedByDelegate(
            eservice.metadata.version,
            descriptor.id,
            eserviceWithWaitingForApprovalDescriptor,
            correlationId
          )
        );
      } else {
        const updatedEService = await processDescriptorPublication(
          eservice.data,
          descriptor,
          readModelService,
          logger
        );

        await repository.createEvent(
          toCreateEventEServiceDescriptorPublished(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            updatedEService,
            correlationId
          )
        );
      }
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Suspending Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (
        descriptor.state !== descriptorState.deprecated &&
        descriptor.state !== descriptorState.published
      ) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
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
        newEservice,
        correlationId
      );
      await repository.createEvent(event);
    },

    async activateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Activating descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      if (descriptor.state !== descriptorState.suspended) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
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
            newEservice,
            correlationId
          );
        } else {
          const newEservice = replaceDescriptor(
            eservice.data,
            deprecateDescriptor(eserviceId, descriptor, logger)
          );

          return toCreateEventEServiceDescriptorActivated(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            newEservice,
            correlationId
          );
        }
      };

      await repository.createEvent(event());
    },

    async cloneDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      assertRequesterIsProducer(eservice.data.producerId, authData);
      await assertNoExistingProducerDelegationInActiveOrPendingState(
        eservice.data.id,
        readModelService
      );

      const clonedEServiceName = `${
        eservice.data.name
      } - clone - ${formatDateddMMyyyyHHmmss(new Date())}`;

      if (
        await readModelService.getEServiceByNameAndProducerId({
          name: clonedEServiceName,
          producerId: eservice.data.producerId,
        })
      ) {
        throw eServiceNameDuplicate(clonedEServiceName);
      }

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      const clonedInterfaceId = generateId<EServiceDocumentId>();
      const clonedInterfacePath =
        descriptor.interface !== undefined
          ? await fileManager.copy(
              config.s3Bucket,
              descriptor.interface.path,
              config.eserviceDocumentsPath,
              clonedInterfaceId,
              descriptor.interface.name,
              logger
            )
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
            doc.name,
            logger
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
      );

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
        clonedEservice,
        correlationId
      );
      await repository.createEvent(event);

      return clonedEservice;
    },

    async archiveDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Archiving Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

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
        newEservice,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorQuotasSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended &&
        descriptor.state !== descriptorState.deprecated
      ) {
        throw notValidDescriptorState(
          descriptorId,
          descriptor.state.toString()
        );
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
        updatedEService,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEService;
    },
    async createRiskAnalysis(
      eserviceId: EServiceId,
      eserviceRiskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Creating Risk Analysis for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertIsDraftEservice(eservice.data);
      assertIsReceiveEservice(eservice.data);

      const tenant = await retrieveTenant(
        eservice.data.producerId,
        readModelService
      );
      assertTenantKindExists(tenant);

      const isDuplicateRiskAnalysis = eservice.data.riskAnalysis.some(
        (ra: RiskAnalysis) =>
          ra.name.toLowerCase() === eserviceRiskAnalysisSeed.name.toLowerCase()
      );

      if (isDuplicateRiskAnalysis) {
        throw riskAnalysisDuplicated(
          eserviceRiskAnalysisSeed.name,
          eservice.data.id
        );
      }

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        eserviceRiskAnalysisSeed.riskAnalysisForm,
        tenant.kind
      );

      const newRiskAnalysis: RiskAnalysis =
        riskAnalysisValidatedFormToNewRiskAnalysis(
          validatedRiskAnalysisForm,
          eserviceRiskAnalysisSeed.name
        );

      const newEservice: EService = {
        ...eservice.data,
        riskAnalysis: [...eservice.data.riskAnalysis, newRiskAnalysis],
      };

      const event = toCreateEventEServiceRiskAnalysisAdded(
        eservice.data.id,
        eservice.metadata.version,
        newRiskAnalysis.id,
        newEservice,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysis["id"],
      eserviceRiskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Updating Risk Analysis ${riskAnalysisId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertIsDraftEservice(eservice.data);
      assertIsReceiveEservice(eservice.data);

      const tenant = await retrieveTenant(
        eservice.data.producerId,
        readModelService
      );
      assertTenantKindExists(tenant);

      const riskAnalysisToUpdate = retrieveRiskAnalysis(
        riskAnalysisId,
        eservice
      );

      const isDuplicateRiskAnalysis = eservice.data.riskAnalysis.some(
        (ra: RiskAnalysis) =>
          ra.id !== riskAnalysisId &&
          ra.name.toLowerCase() === eserviceRiskAnalysisSeed.name.toLowerCase()
      );

      if (isDuplicateRiskAnalysis) {
        throw riskAnalysisDuplicated(
          eserviceRiskAnalysisSeed.name,
          eservice.data.id
        );
      }

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        eserviceRiskAnalysisSeed.riskAnalysisForm,
        tenant.kind
      );

      const updatedRiskAnalysis: RiskAnalysis = {
        ...riskAnalysisToUpdate,
        name: eserviceRiskAnalysisSeed.name,
        riskAnalysisForm: riskAnalysisValidatedFormToNewRiskAnalysisForm(
          validatedRiskAnalysisForm
        ),
      };

      const newEservice = replaceRiskAnalysis(
        eservice.data,
        updatedRiskAnalysis
      );

      const event = toCreateEventEServiceRiskAnalysisUpdated(
        eservice.data.id,
        eservice.metadata.version,
        updatedRiskAnalysis.id,
        newEservice,
        correlationId
      );

      await repository.createEvent(event);
    },
    async deleteRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting Risk Analysis ${riskAnalysisId} for EService ${eserviceId}`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertIsDraftEservice(eservice.data);
      assertIsReceiveEservice(eservice.data);

      retrieveRiskAnalysis(riskAnalysisId, eservice);

      const eserviceWithRiskAnalysisDeleted: EService = {
        ...eservice.data,
        riskAnalysis: eservice.data.riskAnalysis.filter(
          (r) => r.id !== riskAnalysisId
        ),
      };
      const event = toCreateEventEServiceRiskAnalysisDeleted(
        eservice.data.id,
        eservice.metadata.version,
        riskAnalysisId,
        eserviceWithRiskAnalysisDeleted,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateEServiceDescription(
      eserviceId: EServiceId,
      description: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId} description`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const hasValidDescriptor = eservice.data.descriptors.some(
        isDescriptorUpdatable
      );
      if (!hasValidDescriptor) {
        throw eserviceWithoutValidDescriptors(eserviceId);
      }

      const updatedEservice: EService = {
        ...eservice.data,
        description,
      };

      await repository.createEvent(
        toCreateEventEServiceDescriptionUpdated(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        )
      );
      return updatedEservice;
    },
    async updateEServiceDelegationFlags(
      eserviceId: EServiceId,
      {
        isConsumerDelegable,
        isClientAccessDelegable,
      }: {
        isConsumerDelegable: boolean;
        isClientAccessDelegable: boolean;
      },
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating EService ${eserviceId} delegation flags`);
      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const hasValidDescriptor = eservice.data.descriptors.some(
        isDescriptorUpdatable
      );
      if (!hasValidDescriptor) {
        throw eserviceWithoutValidDescriptors(eserviceId);
      }

      if (!isConsumerDelegable && isClientAccessDelegable) {
        throw invalidEServiceFlags(eserviceId);
      }

      const updatedEservice: EService = {
        ...eservice.data,
        isConsumerDelegable,
        isClientAccessDelegable,
      };

      const events = match({
        isConsumerDelegable,
        oldIsConsumerDelegable: eservice.data.isConsumerDelegable || false,
        isClientAccessDelegable,
        oldIsClientAccessDelegable:
          eservice.data.isClientAccessDelegable || false,
      })
        .with(
          {
            isConsumerDelegable: true,
            oldIsConsumerDelegable: false,
            isClientAccessDelegable: false,
            oldIsClientAccessDelegable: false,
          },
          {
            isConsumerDelegable: true,
            oldIsConsumerDelegable: false,
            isClientAccessDelegable: false,
            oldIsClientAccessDelegable: true, // should never happen
          },
          () => [
            toCreateEventEServiceIsConsumerDelegableEnabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            ),
          ]
        )
        .with(
          {
            isConsumerDelegable: true,
            oldIsConsumerDelegable: false,
            isClientAccessDelegable: true,
            oldIsClientAccessDelegable: false,
          },
          () => [
            toCreateEventEServiceIsConsumerDelegableEnabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            ),
            toCreateEventEServiceIsClientAccessDelegableEnabled(
              eservice.metadata.version + 1,
              updatedEservice,
              correlationId
            ),
          ]
        )
        .with(
          {
            isConsumerDelegable: false,
            oldIsConsumerDelegable: true,
          },
          () => [
            toCreateEventEServiceIsConsumerDelegableDisabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            ),
          ]
        )
        .with(
          {
            isConsumerDelegable: true,
            oldIsConsumerDelegable: true,
            isClientAccessDelegable: true,
            oldIsClientAccessDelegable: false,
          },
          () => [
            toCreateEventEServiceIsClientAccessDelegableEnabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            ),
          ]
        )
        .with(
          {
            isConsumerDelegable: true,
            oldIsConsumerDelegable: true,
            isClientAccessDelegable: false,
            oldIsClientAccessDelegable: true,
          },
          () => [
            toCreateEventEServiceIsClientAccessDelegableDisabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            ),
          ]
        )
        .with(
          {
            isConsumerDelegable: false,
            oldIsConsumerDelegable: false,
          },
          {
            isClientAccessDelegable: true,
            oldIsClientAccessDelegable: true,
          },
          {
            isClientAccessDelegable: false,
            oldIsClientAccessDelegable: false,
          },
          () => undefined
        )
        .exhaustive();

      if (events) {
        await repository.createEvents(events);
      }

      return updatedEservice;
    },
    async updateEServiceName(
      eserviceId: EServiceId,
      name: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Updating name of EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      if (
        eservice.data.descriptors.every(
          (descriptor) =>
            descriptor.state === descriptorState.draft ||
            descriptor.state === descriptorState.archived
        )
      ) {
        throw eserviceWithoutValidDescriptors(eserviceId);
      }

      await assertNotDuplicatedEServiceName(
        name,
        eservice.data,
        readModelService
      );

      const updatedEservice: EService = {
        ...eservice.data,
        name,
      };

      await repository.createEvent(
        toCreateEventEServiceNameUpdated(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        )
      );
      return updatedEservice;
    },
    async approveDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Approving EService ${eserviceId} version ${descriptorId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertRequesterIsProducer(eservice.data.producerId, authData);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.waitingForApproval) {
        throw notValidDescriptorState(
          descriptor.id,
          descriptor.state.toString()
        );
      }

      const updatedEService = await processDescriptorPublication(
        eservice.data,
        descriptor,
        readModelService,
        logger
      );

      await repository.createEvent(
        toCreateEventEServiceDescriptorApprovedByDelegator(
          eservice.metadata.version,
          descriptor.id,
          updatedEService,
          correlationId
        )
      );
    },
    async rejectDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      body: catalogApi.RejectDelegatedEServiceDescriptorSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Rejecting EService ${eserviceId} version ${descriptorId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertRequesterIsProducer(eservice.data.producerId, authData);

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state !== descriptorState.waitingForApproval) {
        throw notValidDescriptorState(
          descriptor.id,
          descriptor.state.toString()
        );
      }

      const newRejectionReason: DescriptorRejectionReason = {
        rejectionReason: body.rejectionReason,
        rejectedAt: new Date(),
      };

      const updatedDescriptor = updateDescriptorState(
        {
          ...descriptor,
          rejectionReasons: [
            ...(descriptor.rejectionReasons ?? []),
            newRejectionReason,
          ],
        },
        descriptorState.draft
      );

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      await repository.createEvent(
        toCreateEventEServiceDescriptorRejectedByDelegator(
          eservice.metadata.version,
          descriptor.id,
          updatedEService,
          correlationId
        )
      );
    },
    async updateDescriptorAttributes(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.AttributesSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(
        `Updating attributes of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateRef?.id
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eserviceId,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended
      ) {
        throw notValidDescriptorState(descriptorId, descriptor.state);
      }

      const newAttributes = updateEServiceDescriptorAttributeInAdd(
        eserviceId,
        descriptor,
        seed
      );

      if (newAttributes.length === 0) {
        throw unchangedAttributes(eserviceId, descriptorId);
      }

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        attributes: await parseAndCheckAttributes(seed, readModelService),
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      await repository.createEvent(
        toCreateEventEServiceDescriptorAttributesUpdated(
          eservice.metadata.version,
          descriptor.id,
          newAttributes,
          updatedEService,
          correlationId
        )
      );

      return updatedEService;
    },
    async internalUpdateTemplateInstanceName(
      eserviceId: EServiceId,
      newName: string,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Internal updating name of EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      const instanceLabel = eservice.data.templateRef?.instanceLabel;
      const updatedName = instanceLabel
        ? `${newName} ${instanceLabel}`
        : newName;

      if (updatedName === eservice.data.name) {
        return;
      }

      await assertNotDuplicatedEServiceName(
        updatedName,
        eservice.data,
        readModelService
      );

      const updatedEservice: EService = {
        ...eservice.data,
        name: updatedName,
      };

      await repository.createEvent(
        toCreateEventEServiceNameUpdatedByTemplateUpdate(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        )
      );
    },
    async internalUpdateTemplateInstanceDescription(
      eserviceId: EServiceId,
      description: string,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Internal updating EService ${eserviceId} description`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      if (description === eservice.data.description) {
        return;
      }

      const updatedEservice: EService = {
        ...eservice.data,
        description,
      };
      await repository.createEvent(
        toCreateEventEServiceDescriptionUpdatedByTemplateUpdate(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        )
      );
    },
    async internalUpdateTemplateInstanceDescriptorVoucherLifespan(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      voucherLifespan: number,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Internal updating EService ${eserviceId} descriptor ${descriptorId} voucher lifespan`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.voucherLifespan === voucherLifespan) {
        return;
      }

      const updatedEservice: EService = replaceDescriptor(eservice.data, {
        ...descriptor,
        voucherLifespan,
      });

      await repository.createEvent(
        toCreateEventEServiceDescriptorQuotasUpdatedByTemplateUpdate(
          eservice.data.id,
          eservice.metadata.version,
          descriptorId,
          updatedEservice,
          correlationId
        )
      );
    },
    async internalUpdateTemplateInstanceDescriptorAttributes(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.AttributesSeed,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Internal updating EService ${eserviceId} descriptor ${descriptorId} attributes`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (
        descriptor.state !== descriptorState.published &&
        descriptor.state !== descriptorState.suspended
      ) {
        return;
      }

      const newAttributes = updateEServiceDescriptorAttributeInAdd(
        eserviceId,
        descriptor,
        seed
      );

      if (newAttributes.length === 0) {
        return;
      }

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        attributes: await parseAndCheckAttributes(seed, readModelService),
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      await repository.createEvent(
        toCreateEventEServiceDescriptorAttributesUpdatedByTemplateUpdate(
          eservice.metadata.version,
          descriptor.id,
          newAttributes,
          updatedEService,
          correlationId
        )
      );
    },
    async internalCreateTemplateInstanceDescriptorDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      document: catalogApi.CreateEServiceDescriptorDocumentSeed,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Internal creating e-service document path ${document.filePath} for EService ${eserviceId} and Descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);

      if (descriptor.state === descriptorState.archived) {
        return;
      }

      if (document.kind !== "DOCUMENT") {
        throw operationForbidden;
      }

      const alreadyHasDoc = descriptor.docs.some(
        (d) => d.checksum === document.checksum
      );

      if (alreadyHasDoc) {
        return;
      }

      const newDocument: Document = {
        id: unsafeBrandId(document.documentId),
        name: document.fileName,
        contentType: document.contentType,
        prettyName: document.prettyName,
        path: document.filePath,
        checksum: document.checksum,
        uploadDate: new Date(),
      };

      const updatedEService: EService = replaceDescriptor(eservice.data, {
        ...descriptor,
        docs: [...descriptor.docs, newDocument],
      });

      await repository.createEvent(
        toCreateEventEServiceDescriptorDocumentAddedByTemplateUpdate(
          eservice.metadata.version,
          {
            descriptorId,
            documentId: unsafeBrandId(document.documentId),
            eservice: updatedEService,
          },
          correlationId
        )
      );
    },
    async internalDeleteTemplateInstanceDescriptorDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Internal deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);

      const document = descriptor.docs.find((doc) => doc.id === documentId);

      if (!document) {
        return;
      }

      await fileManager.delete(config.s3Bucket, document.path, logger);

      const newEservice: EService = replaceDescriptor(eservice.data, {
        ...descriptor,
        docs: descriptor.docs.filter((doc) => doc.id !== documentId),
      });

      await repository.createEvent(
        toCreateEventEServiceDescriptorDocumentDeletedByTemplateUpdate(
          eserviceId,
          eservice.metadata.version,
          {
            descriptorId,
            documentId,
            eservice: newEservice,
          },
          correlationId
        )
      );
    },

    async innerUpdateTemplateInstanceDescriptorDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { prettyName }: catalogApi.UpdateEServiceDescriptorDocumentSeed,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Internal updating Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eservice);

      const document = descriptor.docs.find((doc) => doc.id === documentId);

      if (document === undefined) {
        throw eServiceDocumentNotFound(eserviceId, descriptor.id, documentId);
      }

      if (descriptor.docs.some((d) => d.prettyName === prettyName)) {
        return;
      }

      const updatedDocument = {
        ...document,
        prettyName,
      };

      const newEservice: EService = replaceDescriptor(eservice.data, {
        ...descriptor,
        docs: descriptor.docs.map((doc) =>
          doc.id === documentId ? updatedDocument : doc
        ),
      });

      await repository.createEvent(
        toCreateEventEServiceDescriptorDocumentUpdatedByTemplateUpdate(
          eserviceId,
          eservice.metadata.version,
          {
            descriptorId,
            documentId,
            eservice: newEservice,
          },
          correlationId
        )
      );
    },
    async upgradeEServiceInstance(
      eserviceId: EServiceId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EService> {
      logger.info(`Upgrading EService ${eserviceId} instance`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const templateId = eservice.data.templateRef?.id;
      if (!templateId) {
        throw eServiceNotAnInstance(eserviceId);
      }
      const template = await retrieveEServiceTemplate(
        templateId,
        readModelService
      );

      const lastVersion = template.versions.reduce(
        (max, version) => (version.version > max.version ? version : max),
        template.versions[0]
      );
      if (
        eservice.data.descriptors.some(
          (d) => d.templateVersionRef?.id === lastVersion.id
        )
      ) {
        throw eServiceAlreadyUpgraded(eserviceId);
      }

      const docs = await Promise.all(
        // eslint-disable-next-line sonarjs/no-identical-functions
        lastVersion.docs.map(async (doc) => {
          const clonedDocumentId = generateId<EServiceDocumentId>();
          const clonedDocumentPath = await fileManager.copy(
            config.s3Bucket,
            doc.path,
            config.eserviceDocumentsPath,
            clonedDocumentId,
            doc.name,
            logger
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
      );

      const newVersion = nextDescriptorVersion(eservice.data);
      const newDescriptor: Descriptor = {
        id: generateId(),
        templateVersionRef: lastVersion.id ? { id: lastVersion.id } : undefined,
        description: lastVersion.description,
        version: newVersion,
        interface: undefined,
        docs,
        state: descriptorState.draft,
        voucherLifespan: lastVersion.voucherLifespan,
        audience: [],
        dailyCallsPerConsumer: lastVersion.dailyCallsPerConsumer ?? 1,
        dailyCallsTotal: lastVersion.dailyCallsTotal ?? 1,
        agreementApprovalPolicy: lastVersion.agreementApprovalPolicy,
        serverUrls: [],
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        archivedAt: undefined,
        createdAt: new Date(),
        attributes: lastVersion.attributes,
        rejectionReasons: undefined,
      };
      const upgradedEService: EService = {
        ...eservice.data,
        descriptors: [...eservice.data.descriptors, newDescriptor],
      };

      await repository.createEvent(
        toCreateEventEServiceDescriptorAdded(
          upgradedEService,
          eservice.metadata.version,
          newDescriptor.id,
          correlationId
        )
      );

      return upgradedEService;
    },
    async createEServiceInstanceFromTemplate(
      templateId: EServiceTemplateId,
      seed: catalogApi.InstanceEServiceSeed,
      ctx: WithLogger<AppContext>
    ): Promise<EService> {
      ctx.logger.info(`Creating EService from template ${templateId}`);

      const template = await readModelService.getEServiceTemplateById(
        templateId
      );

      if (!template) {
        throw eServiceTemplateNotFound(templateId);
      }

      const publishedVersion = template.versions.find(
        (version) => version.state === eserviceTemplateVersionState.published
      );

      if (!publishedVersion) {
        throw eServiceTemplateWithoutPublishedVersion(templateId);
      }

      const tenant = await retrieveTenant(
        ctx.authData.organizationId,
        readModelService
      );

      assertTenantKindExists(tenant);

      const riskAnalysis: RiskAnalysis[] = template.riskAnalysis
        .filter((r) =>
          match(tenant.kind)
            .with(tenantKind.PA, () => r.tenantKind === tenantKind.PA)
            .with(
              tenantKind.GSP,
              tenantKind.PRIVATE,
              tenantKind.SCP,
              (t) =>
                [tenantKind.GSP, tenantKind.PRIVATE, tenantKind.SCP].includes(
                  r.tenantKind as typeof t
                )
              /**
               * For now, GSP, PRIVATE, and SCP tenants share the same risk analysis.
               * This may change in the future.
               */
            )
            .exhaustive()
        )
        .map((r) => ({
          id: generateId(),
          createdAt: r.createdAt,
          name: r.name,
          riskAnalysisForm: r.riskAnalysisForm,
        }));

      if (template.mode === eserviceMode.receive && riskAnalysis.length === 0) {
        throw receiveTemplateMissingTenantKindRiskAnalysis(
          template.id,
          tenant.id,
          tenant.kind
        );
      }

      const { eService: createdEService, events } = await innerCreateEService(
        {
          eServiceSeed: {
            name: `${template.name} ${seed.instanceLabel ?? ""}`.trim(),
            description: template.description,
            technology: technologyToApiTechnology(template.technology),
            mode: eServiceModeToApiEServiceMode(template.mode),
            descriptor: {
              description: publishedVersion.description,
              audience: [],
              voucherLifespan: publishedVersion.voucherLifespan,
              dailyCallsPerConsumer:
                publishedVersion.dailyCallsPerConsumer ?? 1,
              dailyCallsTotal: publishedVersion.dailyCallsTotal ?? 1,
              agreementApprovalPolicy:
                agreementApprovalPolicyToApiAgreementApprovalPolicy(
                  publishedVersion.agreementApprovalPolicy
                ),
            },
            isSignalHubEnabled:
              seed.isSignalHubEnabled ?? template.isSignalHubEnabled,
            isConsumerDelegable: seed.isConsumerDelegable ?? false,
            isClientAccessDelegable: seed.isClientAccessDelegable ?? false,
          },
          eServiceTemplateReferences: {
            templateId: template.id,
            templateVersionId: publishedVersion.id,
            instanceLabel: seed.instanceLabel,
          },
          riskAnalysis,
        },
        readModelService,
        ctx
      );

      const docEvents = [];
      // eslint-disable-next-line functional/no-let
      let lastEService = createdEService;
      for (const [index, doc] of publishedVersion.docs.entries()) {
        const clonedDocumentId = generateId<EServiceDocumentId>();
        const clonedDocumentPath = await fileManager.copy(
          config.s3Bucket,
          doc.path,
          config.eserviceDocumentsPath,
          clonedDocumentId,
          doc.name,
          ctx.logger
        );
        const { eService, event } = await innerAddDocumentToEserviceEvent(
          { data: lastEService, metadata: { version: index + 1 } },
          createdEService.descriptors[0].id,
          {
            documentId: clonedDocumentId,
            kind: "DOCUMENT",
            prettyName: doc.prettyName,
            filePath: clonedDocumentPath,
            fileName: doc.name,
            contentType: doc.contentType,
            checksum: doc.checksum,
            serverUrls: [], // not used in case of kind == "DOCUMENT"
          },
          publishedVersion.id,
          readModelService,
          ctx
        );
        // eslint-disable-next-line functional/immutable-data
        docEvents.push(event);
        lastEService = eService;
      }

      await repository.createEvents([...events, ...docEvents]);

      return lastEService;
    },
    async addEServiceTemplateInstanceInterface(
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      eserviceInstanceInterfaceData: catalogApi.TemplateInstanceInterfaceMetadata,
      ctx: WithLogger<AppContext>
    ): Promise<EService> {
      const { logger, authData } = ctx;
      logger.info(
        `Adding interface to EService template instance ${eServiceId} with descriptor ${descriptorId}`
      );

      const eserviceWithMetadata = await retrieveEService(
        eServiceId,
        readModelService
      );

      const eservice = eserviceWithMetadata.data;
      const descriptor = retrieveDescriptor(descriptorId, eserviceWithMetadata);
      assertIsDraftEservice(eservice);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.producerId,
        eservice.id,
        authData,
        readModelService
      );

      const { eserviceTemplateId, eserviceTemplateVersionId } =
        getTemplateDataFromEservice(eservice, descriptor);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      const eserviceTemplateVersion = retrieveEServicePublishedTemplateVersion(
        eserviceTemplate,
        eserviceTemplateVersionId
      );

      const templateInterface = eserviceTemplateVersion.interface;
      if (!templateInterface) {
        throw eserviceTemplateInterfaceNotFound(
          eserviceTemplateId,
          eserviceTemplateVersionId
        );
      }

      const { eService: updatedEService, event: addDocumentEvent } =
        await createOpenApiInterfaceByTemplate(
          eserviceWithMetadata,
          descriptor.id,
          templateInterface,
          eserviceInstanceInterfaceData,
          config.eserviceTemplateDocumentsContainer,
          fileManager,
          readModelService,
          ctx
        );

      await repository.createEvent(addDocumentEvent);

      return updatedEService;
    },
  };
}

// eslint-disable-next-line max-params
export async function createOpenApiInterfaceByTemplate(
  eserviceWithMetadata: WithMetadata<EService>,
  descriptorId: DescriptorId,
  eserviceTemplateInterface: Document,
  eserviceInstanceInterfaceData: catalogApi.TemplateInstanceInterfaceMetadata,
  bucket: string,
  fileManager: FileManager,
  readModelService: ReadModelService,
  ctx: WithLogger<AppContext>
): Promise<{ eService: EService; event: CreateEvent<EServiceEvent> }> {
  const eservice = eserviceWithMetadata.data;
  const interfaceTemplate = await fileManager.get(
    bucket,
    eserviceTemplateInterface.path,
    ctx.logger
  );

  if (eserviceInstanceInterfaceData.serverUrls.length < 1) {
    throw eserviceInterfaceDataNotValid();
  }

  const documentId = unsafeBrandId<EServiceDocumentId>(randomUUID());
  const newInterfaceFile = await interpolateOpenApiSpec(
    eservice,
    Buffer.from(interfaceTemplate).toString(),
    eserviceTemplateInterface,
    eserviceInstanceInterfaceData
  );

  return await verifyAndCreateDocument(
    fileManager,
    eservice.id,
    eservice.technology,
    "INTERFACE",
    newInterfaceFile,
    documentId,
    config.eserviceTemplateDocumentsContainer,
    config.eserviceDocumentsPath,
    eserviceTemplateInterface.prettyName,
    async (
      documentId,
      fileName,
      filePath,
      prettyName,
      kind,
      serverUrls,
      contentType,
      checksum
    ) =>
      await innerAddDocumentToEserviceEvent(
        eserviceWithMetadata,
        descriptorId,
        {
          documentId,
          kind,
          prettyName,
          filePath,
          fileName,
          contentType,
          checksum,
          serverUrls,
          interfaceTemplateMetadata: eserviceInstanceInterfaceData,
        },
        undefined,
        readModelService,
        ctx
      ),
    ctx.logger
  );
}

function isRequesterEServiceProducer(
  eservice: EService,
  authData: AuthData
): boolean {
  return (
    hasPermission(
      [userRoles.ADMIN_ROLE, userRoles.API_ROLE, userRoles.SUPPORT_ROLE],
      authData
    ) && authData.organizationId === eservice.producerId
  );
}

async function applyVisibilityToEService(
  eservice: EService,
  authData: AuthData,
  readModelService: ReadModelService
): Promise<EService> {
  if (isRequesterEServiceProducer(eservice, authData)) {
    return eservice;
  }

  const producerDelegation = await readModelService.getLatestDelegation({
    eserviceId: eservice.id,
    delegateId: authData.organizationId,
    kind: delegationKind.delegatedProducer,
  });

  if (producerDelegation?.state === delegationState.active) {
    return eservice;
  }

  const hasNoActiveDescriptor = eservice.descriptors.every(
    isNotActiveDescriptor
  );

  if (!producerDelegation && hasNoActiveDescriptor) {
    throw eServiceNotFound(eservice.id);
  }

  return {
    ...eservice,
    descriptors: eservice.descriptors.filter(isActiveDescriptor),
  };
}

const deleteDescriptorInterfaceAndDocs = async (
  descriptor: Descriptor,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const descriptorInterface = descriptor.interface;
  if (descriptorInterface !== undefined) {
    await fileManager.delete(config.s3Bucket, descriptorInterface.path, logger);
  }

  const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
    fileManager.delete(config.s3Bucket, doc.path, logger)
  );

  await Promise.all(deleteDescriptorDocs);
};

const processDescriptorPublication = async (
  eservice: EService,
  descriptor: Descriptor,
  readModelService: ReadModelService,
  logger: Logger
): Promise<EService> => {
  const currentActiveDescriptor = eservice.descriptors.find(
    (d: Descriptor) => d.state === descriptorState.published
  );

  const publishedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );

  const eserviceWithPublishedDescriptor = replaceDescriptor(
    eservice,
    publishedDescriptor
  );

  if (!currentActiveDescriptor) {
    return eserviceWithPublishedDescriptor;
  }

  const currentEServiceAgreements = await readModelService.listAgreements({
    eservicesIds: [eservice.id],
    consumersIds: [],
    producersIds: [],
    states: [agreementState.active, agreementState.suspended],
    limit: 1,
    descriptorId: currentActiveDescriptor.id,
  });

  return replaceDescriptor(
    eserviceWithPublishedDescriptor,
    currentEServiceAgreements.length === 0
      ? archiveDescriptor(eservice.id, currentActiveDescriptor, logger)
      : deprecateDescriptor(eservice.id, currentActiveDescriptor, logger)
  );
};

function updateEServiceDescriptorAttributeInAdd(
  eserviceId: EServiceId,
  descriptor: Descriptor,
  seed: catalogApi.AttributesSeed
): AttributeId[] {
  /**
   * In order for the descriptor attributes to be updatable,
   * each attribute group contained in the seed must be a superset
   * of the corresponding attribute group in the descriptor,
   * meaning that each attribute group in the seed must contain all the attributes
   * of his corresponding group in the descriptor, plus, optionally, some ones.
   */
  function validateAndRetrieveNewAttributes(
    attributesDescriptor: EServiceAttribute[][],
    attributesSeed: catalogApi.Attribute[][]
  ): string[] {
    // If the seed has a different number of attribute groups than the descriptor, it's invalid
    if (attributesDescriptor.length !== attributesSeed.length) {
      throw inconsistentAttributesSeedGroupsCount(eserviceId, descriptor.id);
    }

    return attributesDescriptor.flatMap((attributeGroup) => {
      // Get the seed group that is a superset of the descriptor group
      const supersetSeed = attributesSeed.find((seedGroup) =>
        attributeGroup.every((descriptorAttribute) =>
          seedGroup.some(
            (seedAttribute) => descriptorAttribute.id === seedAttribute.id
          )
        )
      );

      if (!supersetSeed) {
        throw descriptorAttributeGroupSupersetMissingInAttributesSeed(
          eserviceId,
          descriptor.id
        );
      }

      // Return only the new attributes
      return supersetSeed
        .filter(
          (seedAttribute) =>
            !attributeGroup.some((att) => att.id === seedAttribute.id)
        )
        .flatMap((seedAttribute) => seedAttribute.id);
    });
  }

  const certifiedAttributes = validateAndRetrieveNewAttributes(
    descriptor.attributes.certified,
    seed.certified
  );

  const verifiedAttributes = validateAndRetrieveNewAttributes(
    descriptor.attributes.verified,
    seed.verified
  );

  const declaredAttributes = validateAndRetrieveNewAttributes(
    descriptor.attributes.declared,
    seed.declared
  );

  return [
    ...certifiedAttributes,
    ...verifiedAttributes,
    ...declaredAttributes,
  ].map(unsafeBrandId<AttributeId>);
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
