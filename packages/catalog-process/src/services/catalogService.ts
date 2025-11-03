/* eslint-disable max-params */
import { randomUUID } from "crypto";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  CreateEvent,
  DB,
  eventRepository,
  FileManager,
  InternalAuthData,
  Logger,
  M2MAuthData,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  UIAuthData,
  verifyAndCreateDocument,
  WithLogger,
  formatDateddMMyyyyHHmmss,
  assertFeatureFlagEnabled,
  isFeatureFlagEnabled,
  M2MAdminAuthData,
  interpolateTemplateApiSpec,
  authRole,
  retrieveOriginFromAuthData,
} from "pagopa-interop-commons";
import {
  agreementApprovalPolicy,
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
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  generateId,
  ListResult,
  operationForbidden,
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  TenantId,
  unsafeBrandId,
  tenantKind,
  WithMetadata,
  AttributeKind,
  attributeKind,
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
  eServiceNotAnInstance,
  eServiceNotFound,
  eServiceRiskAnalysisNotFound,
  eserviceTemplateInterfaceNotFound,
  eServiceTemplateNotFound,
  eServiceTemplateWithoutPublishedVersion,
  eserviceWithoutValidDescriptors,
  inconsistentAttributesSeedGroupsCount,
  interfaceAlreadyExists,
  invalidEServiceFlags,
  notValidDescriptorState,
  originNotCompliant,
  riskAnalysisDuplicated,
  descriptorTemplateVersionNotFound,
  tenantNotFound,
  unchangedAttributes,
  templateMissingRequiredRiskAnalysis,
  checksumDuplicate,
  attributeDuplicatedInGroup,
  eservicePersonalDataFlagCanOnlyBeSetOnce,
  missingPersonalDataFlag,
  eServiceTemplateWithoutPersonalDataFlag,
} from "../model/domain/errors.js";
import { ApiGetEServicesFilters, Consumer } from "../model/domain/models.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptionUpdated,
  toCreateEventEServiceDescriptionUpdatedByTemplateUpdate,
  toCreateEventEServiceDescriptorActivated,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorApprovedByDelegator,
  toCreateEventEServiceDescriptorAgreementApprovalPolicyUpdated,
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
  toCreateEventEServiceSignalhubFlagEnabled,
  toCreateEventEServiceSignalhubFlagDisabled,
  toCreateEventEServicePersonalDataFlagUpdatedAfterPublication,
  toCreateEventEServicePersonalDataFlagUpdatedByTemplateUpdate,
} from "../model/domain/toEvent.js";
import {
  getLatestDescriptor,
  nextDescriptorVersion,
} from "../utilities/versionGenerator.js";
import {
  assertDocumentDeletableDescriptorState,
  assertEServiceNotTemplateInstance,
  assertHasNoDraftOrWaitingForApprovalDescriptor,
  assertInterfaceDeletableDescriptorState,
  assertIsDraftEservice,
  assertIsReceiveEservice,
  assertNoExistingProducerDelegationInActiveOrPendingState,
  assertEServiceNameAvailableForProducer,
  assertRequesterIsDelegateProducerOrProducer,
  assertRequesterIsProducer,
  assertRiskAnalysisIsValidForPublication,
  assertTenantKindExists,
  descriptorStatesNotAllowingDocumentOperations,
  isActiveDescriptor,
  validateRiskAnalysisSchemaOrThrow,
  assertEServiceIsTemplateInstance,
  assertConsistentDailyCalls,
  assertIsDraftDescriptor,
  assertDescriptorUpdatableAfterPublish,
  assertEServiceUpdatableAfterPublish,
  hasRoleToAccessInactiveDescriptors,
  assertEServiceNameNotConflictingWithTemplate,
} from "./validators.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
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
  readModelService: Pick<ReadModelServiceSQL, "getTenantById">
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
  authData: UIAuthData | M2MAdminAuthData
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
  readModelService: ReadModelServiceSQL
): Promise<Delegation | undefined> =>
  await readModelService.getLatestDelegation({
    eserviceId: eservice.id,
    kind: delegationKind.delegatedProducer,
    states: [delegationState.active],
  });

const retrieveEServiceTemplate = async (
  eserviceTemplateId: EServiceTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<EServiceTemplate> => {
  const eserviceTemplate = await readModelService.getEServiceTemplateById(
    eserviceTemplateId
  );
  if (eserviceTemplate === undefined) {
    throw eServiceTemplateNotFound(eserviceTemplateId);
  }
  return eserviceTemplate;
};

const getTemplateDataFromEservice = (
  eservice: EService,
  descriptor: Descriptor
): {
  eserviceTemplateId: EServiceTemplateId;
  eserviceTemplateVersionId: EServiceTemplateVersionId;
} => {
  const eserviceTemplateId = eservice.templateId;
  const eserviceTemplateVersionId = descriptor.templateVersionRef?.id;

  if (!eserviceTemplateId || !eserviceTemplateVersionId) {
    throw eServiceNotAnInstance(eservice.id);
  }

  return {
    eserviceTemplateId: unsafeBrandId(eserviceTemplateId),
    eserviceTemplateVersionId: unsafeBrandId(eserviceTemplateVersionId),
  };
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

async function parseAndCheckAttributesOfKind(
  attributesSeedForKind: catalogApi.AttributeSeed[][],
  kind: AttributeKind,
  readModelService: ReadModelServiceSQL
): Promise<EServiceAttribute[][]> {
  const parsedAttributesSeed = attributesSeedForKind.map((group) => {
    const groupAttributesIdsFound: Set<AttributeId> = new Set();
    return group.map((att) => {
      const id = unsafeBrandId<AttributeId>(att.id);
      if (groupAttributesIdsFound.has(id)) {
        throw attributeDuplicatedInGroup(id);
      }

      groupAttributesIdsFound.add(id);
      return {
        ...att,
        id,
      };
    });
  });

  const attributesSeedIds: AttributeId[] = parsedAttributesSeed
    .flat()
    .map(({ id }) => id);

  const attributes = await readModelService.getAttributesByIds(
    attributesSeedIds,
    kind
  );

  const attributesIds = attributes.map((attr) => attr.id);
  attributesSeedIds.forEach((attributeId) => {
    if (!attributesIds.includes(attributeId)) {
      throw attributeNotFound(attributeId);
    }
  });

  return parsedAttributesSeed;
}

export async function parseAndCheckAttributes(
  attributesSeed: catalogApi.AttributesSeed,
  readModelService: ReadModelServiceSQL
): Promise<EserviceAttributes> {
  const [certifiedAttributes, declaredAttributes, verifiedAttributes] =
    await Promise.all([
      parseAndCheckAttributesOfKind(
        attributesSeed.certified,
        attributeKind.certified,
        readModelService
      ),
      parseAndCheckAttributesOfKind(
        attributesSeed.declared,
        attributeKind.declared,
        readModelService
      ),
      parseAndCheckAttributesOfKind(
        attributesSeed.verified,
        attributeKind.verified,
        readModelService
      ),
    ]);

  return {
    certified: certifiedAttributes,
    declared: declaredAttributes,
    verified: verifiedAttributes,
  };
}

function isTenantInSignalHubWhitelist(
  organizationId: TenantId,
  isSignalHubEnabled: boolean | undefined
): boolean | undefined {
  return config.signalhubWhitelistProducer?.includes(organizationId)
    ? isSignalHubEnabled
    : false;
}

async function innerCreateEService(
  {
    seed,
    template,
  }: {
    seed: catalogApi.EServiceSeed;
    template:
      | {
          id: EServiceTemplateId;
          versionId: EServiceTemplateVersionId;
          attributes: EserviceAttributes;
          riskAnalysis: RiskAnalysis[] | undefined;
        }
      | undefined;
  },
  readModelService: ReadModelServiceSQL,
  {
    authData,
    correlationId,
  }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
): Promise<{
  eService: EService;
  events: Array<CreateEvent<EServiceEvent>>;
}> {
  const origin = await retrieveOriginFromAuthData(
    authData,
    readModelService,
    retrieveTenant
  );

  if (!config.producerAllowedOrigins.includes(origin)) {
    throw originNotCompliant(origin);
  }

  const creationDate = new Date();
  const newEService: EService = {
    id: generateId(),
    producerId: authData.organizationId,
    name: seed.name,
    description: seed.description,
    technology: apiTechnologyToTechnology(seed.technology),
    mode: apiEServiceModeToEServiceMode(seed.mode),
    attributes: undefined,
    descriptors: [],
    createdAt: creationDate,
    riskAnalysis: template?.riskAnalysis ?? [],
    isSignalHubEnabled: isFeatureFlagEnabled(
      config,
      "featureFlagSignalhubWhitelist"
    )
      ? isTenantInSignalHubWhitelist(
          authData.organizationId,
          seed.isSignalHubEnabled
        )
      : seed.isSignalHubEnabled,
    isConsumerDelegable: seed.isConsumerDelegable,
    isClientAccessDelegable: match(seed.isConsumerDelegable)
      .with(P.nullish, () => undefined)
      .with(false, () => false)
      .with(true, () => seed.isClientAccessDelegable)
      .exhaustive(),
    templateId: template?.id,
    ...(isFeatureFlagEnabled(config, "featureFlagEservicePersonalData")
      ? { personalData: seed.personalData }
      : {}),
  };

  const eserviceCreationEvent = toCreateEventEServiceAdded(
    newEService,
    correlationId
  );

  assertConsistentDailyCalls(seed.descriptor);

  const templateVersionId = template?.versionId;

  const draftDescriptor: Descriptor = {
    id: generateId(),
    description: seed.descriptor.description,
    version: "1",
    interface: undefined,
    docs: [],
    state: descriptorState.draft,
    voucherLifespan: seed.descriptor.voucherLifespan,
    audience: seed.descriptor.audience,
    dailyCallsPerConsumer: seed.descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: seed.descriptor.dailyCallsTotal,
    agreementApprovalPolicy:
      apiAgreementApprovalPolicyToAgreementApprovalPolicy(
        seed.descriptor.agreementApprovalPolicy
      ),
    serverUrls: [],
    publishedAt: undefined,
    suspendedAt: undefined,
    deprecatedAt: undefined,
    archivedAt: undefined,
    createdAt: creationDate,
    attributes: template?.attributes ?? {
      certified: [],
      declared: [],
      verified: [],
    },
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
  ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
): Promise<{
  eService: EService;
  descriptor: Descriptor;
  createdDocument: Document;
  event: CreateEvent<EServiceEvent>;
}> {
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

  if (
    documentSeed.kind === "DOCUMENT" &&
    descriptor.docs.some((d) => d.checksum === documentSeed.checksum)
  ) {
    throw checksumDuplicate(eService.data.id, descriptor.id);
  }

  const isInterface = documentSeed.kind === "INTERFACE";
  const createdDocument: Document = {
    id: unsafeBrandId(documentSeed.documentId),
    name: documentSeed.fileName,
    contentType: documentSeed.contentType,
    prettyName: documentSeed.prettyName,
    path: documentSeed.filePath,
    checksum: documentSeed.checksum,
    uploadDate: new Date(),
  };

  const updatedDescriptor: Descriptor = {
    ...descriptor,
    interface: isInterface ? createdDocument : descriptor.interface,
    docs: isInterface ? descriptor.docs : [...descriptor.docs, createdDocument],
    serverUrls: isInterface ? documentSeed.serverUrls : descriptor.serverUrls,
    templateVersionRef: evaluateTemplateVersionRef(descriptor, documentSeed),
  };

  const updatedEService: EService = replaceDescriptor(
    eService.data,
    updatedDescriptor
  );

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
          ctx.correlationId
        )
      : toCreateEventEServiceDocumentAdded(
          eService.metadata.version,
          {
            descriptorId,
            documentId: unsafeBrandId(documentSeed.documentId),
            eservice: updatedEService,
          },
          ctx.correlationId
        );

  return {
    eService: updatedEService,
    descriptor: updatedDescriptor,
    createdDocument,
    event,
  };
}

function createNextDescriptor(
  eservice: EService,
  seed: Pick<
    Descriptor,
    | "description"
    | "voucherLifespan"
    | "audience"
    | "dailyCallsPerConsumer"
    | "dailyCallsTotal"
    | "agreementApprovalPolicy"
    | "attributes"
    | "docs"
  > & {
    templateVersionId: EServiceTemplateVersionId | undefined;
  }
): Descriptor {
  return {
    id: generateId<DescriptorId>(),
    description: seed.description,
    version: nextDescriptorVersion(eservice),
    interface: undefined,
    docs: seed.docs,
    state: descriptorState.draft,
    voucherLifespan: seed.voucherLifespan,
    audience: seed.audience,
    dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
    dailyCallsTotal: seed.dailyCallsTotal,
    agreementApprovalPolicy: seed.agreementApprovalPolicy,
    serverUrls: [],
    publishedAt: undefined,
    suspendedAt: undefined,
    deprecatedAt: undefined,
    archivedAt: undefined,
    createdAt: new Date(),
    attributes: seed.attributes,
    rejectionReasons: undefined,
    templateVersionRef: seed.templateVersionId
      ? { id: seed.templateVersionId }
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL,
  fileManager: FileManager
) {
  const repository = eventRepository(dbInstance, catalogEventToBinaryData);
  return {
    async getEServiceById(
      eserviceId: EServiceId,
      {
        authData,
        logger,
      }: WithLogger<
        AppContext<
          UIAuthData | M2MAuthData | M2MAdminAuthData | InternalAuthData
        >
      >
    ): Promise<WithMetadata<EService>> {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      const data = await applyVisibilityToEService(
        eservice.data,
        authData,
        readModelService
      );
      return {
        data,
        metadata: {
          version: eservice.metadata.version,
        },
      };
    },

    async getEServices(
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<EService>> {
      logger.info(
        `Getting EServices with name = ${filters.name}, ids = ${filters.eservicesIds}, producers = ${filters.producersIds}, states = ${filters.states}, agreementStates = ${filters.agreementStates}, technology = ${filters.technology}, mode = ${filters.mode}, isSignalHubEnabled = ${filters.isSignalHubEnabled}, isConsumerDelegable = ${filters.isConsumerDelegable}, isClientAccessDelegable = ${filters.isClientAccessDelegable}, personalData = ${filters.personalData} limit = ${limit}, offset = ${offset}`
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
      { logger }: WithLogger<AppContext>
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
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
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

    async getDocuments(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { offset, limit }: catalogApi.GetEServiceDocumentsQueryParams,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData | M2MAuthData>>
    ): Promise<ListResult<Document>> {
      logger.info(
        `Retrieving EService documents for EService ${eserviceId} and descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      const checkedEService = await applyVisibilityToEService(
        eservice.data,
        authData,
        readModelService
      );

      retrieveDescriptorFromEService(descriptorId, checkedEService);
      // ^ to check that descriptor exists

      return readModelService.getEServiceDescriptorDocuments(
        eserviceId,
        descriptorId,
        offset,
        limit
      );
    },

    async createEService(
      seed: catalogApi.EServiceSeed,
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      ctx.logger.info(`Creating EService with name ${seed.name}`);

      await assertEServiceNameAvailableForProducer(
        seed.name,
        ctx.authData.organizationId,
        readModelService
      );
      await assertEServiceNameNotConflictingWithTemplate(
        seed.name,
        readModelService
      );

      const { eService, events } = await innerCreateEService(
        { seed, template: undefined },
        readModelService,
        ctx
      );

      const createdEvents = await repository.createEvents(events);

      return {
        data: eService,
        metadata: {
          version: createdEvents.latestNewVersion.get(events[0].streamId) ?? 0,
        },
      };
    },

    async updateEService(
      eserviceId: EServiceId,
      eserviceSeed: catalogApi.UpdateEServiceSeed,
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<EService>> {
      ctx.logger.info(`Updating EService ${eserviceId}`);
      return updateDraftEService(
        eserviceId,
        { type: "put", seed: eserviceSeed },
        readModelService,
        fileManager,
        repository,
        ctx
      );
    },

    async patchUpdateEService(
      eserviceId: EServiceId,
      eserviceSeed: catalogApi.PatchUpdateEServiceSeed,
      ctx: WithLogger<AppContext<M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      ctx.logger.info(`Partially updating EService ${eserviceId}`);
      return updateDraftEService(
        eserviceId,
        { type: "patch", seed: eserviceSeed },
        readModelService,
        fileManager,
        repository,
        ctx
      );
    },

    async updateEServiceTemplateInstance(
      eserviceId: EServiceId,
      eserviceSeed: catalogApi.UpdateEServiceTemplateInstanceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
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
      assertIsDraftEservice(eservice.data);

      const updatedEService: EService = {
        ...eservice.data,
        isSignalHubEnabled: config.featureFlagSignalhubWhitelist
          ? isTenantInSignalHubWhitelist(
              authData.organizationId,
              eserviceSeed.isSignalHubEnabled
            )
          : eserviceSeed.isSignalHubEnabled,
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
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
      ctx: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Document>> {
      ctx.logger.info(
        `Creating EService Document ${document.documentId.toString()} of kind ${
          document.kind
        }, name ${document.fileName}, path ${
          document.filePath
        } for EService ${eserviceId} and Descriptor ${descriptorId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        ctx.authData,
        readModelService
      );

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );

      const { createdDocument, event } = await innerAddDocumentToEserviceEvent(
        eservice,
        descriptorId,
        document,
        ctx
      );

      const createdEvent = await repository.createEvent(event);

      return {
        data: createdDocument,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
    },

    async deleteDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(
        `Deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

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
        assertEServiceNotTemplateInstance(
          eservice.data.id,
          eservice.data.templateId
        );
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

      const createdEvent = await repository.createEvent(event);

      return {
        data: newEservice,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
    },

    // eslint-disable-next-line max-params
    async updateDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: catalogApi.UpdateEServiceDescriptorDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Document> {
      logger.info(
        `Updating Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<{
        eservice: EService;
        createdDescriptorId: DescriptorId;
      }>
    > {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );
      assertHasNoDraftOrWaitingForApprovalDescriptor(eservice.data);

      const parsedAttributes = await parseAndCheckAttributes(
        eserviceDescriptorSeed.attributes,
        readModelService
      );

      assertConsistentDailyCalls(eserviceDescriptorSeed);

      const eserviceVersion = eservice.metadata.version;
      const newDescriptor: Descriptor = createNextDescriptor(eservice.data, {
        description: eserviceDescriptorSeed.description,
        voucherLifespan: eserviceDescriptorSeed.voucherLifespan,
        audience: eserviceDescriptorSeed.audience,
        dailyCallsPerConsumer: eserviceDescriptorSeed.dailyCallsPerConsumer,
        dailyCallsTotal: eserviceDescriptorSeed.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            eserviceDescriptorSeed.agreementApprovalPolicy
          ),
        attributes: parsedAttributes,
        docs: [],
        templateVersionId: undefined,
      });

      const updatedEService: EService = {
        ...eservice.data,
        descriptors: [...eservice.data.descriptors, newDescriptor],
      };

      const descriptorCreationEvent = toCreateEventEServiceDescriptorAdded(
        updatedEService,
        eserviceVersion,
        newDescriptor.id,
        correlationId
      );

      const { events, updatedEServiceWithDocs } =
        eserviceDescriptorSeed.docs.reduce(
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

            const currentDescriptor =
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              acc.updatedEServiceWithDocs.descriptors.find(
                (d) => d.id === newDescriptor.id
              )!;

            const updatedEServiceWithDocs = replaceDescriptor(
              acc.updatedEServiceWithDocs,
              {
                ...currentDescriptor,
                docs: [...currentDescriptor.docs, newDocument],
              }
            );
            const version = eserviceVersion + index + 1;
            const documentEvent = toCreateEventEServiceDocumentAdded(
              version,
              {
                descriptorId: newDescriptor.id,
                documentId: unsafeBrandId(document.documentId),
                eservice: updatedEServiceWithDocs,
              },
              correlationId
            );
            return {
              events: [...acc.events, documentEvent],
              updatedEServiceWithDocs,
            };
          },
          {
            events: [descriptorCreationEvent],
            updatedEServiceWithDocs: updatedEService,
          }
        );

      const createdEvents = await repository.createEvents(events);

      return {
        data: {
          eservice: updatedEServiceWithDocs,
          createdDescriptorId: newDescriptor.id,
        },
        metadata: {
          version: createdEvents.latestNewVersion.get(events[0].streamId) ?? 0,
        },
      };
    },

    async deleteDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService> | undefined> {
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

        return undefined;
      } else {
        const event = await repository.createEvent(descriptorDeletionEvent);

        return {
          data: eserviceAfterDescriptorDeletion,
          metadata: { version: event.newVersion },
        };
      }
    },

    async updateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorSeed,
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<EService>> {
      ctx.logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      return updateDraftDescriptor(
        eserviceId,
        descriptorId,
        seed,
        readModelService,
        repository,
        ctx
      );
    },

    async patchUpdateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.PatchUpdateEServiceDescriptorSeed,
      ctx: WithLogger<AppContext<M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      ctx.logger.info(
        `Partially updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      return updateDraftDescriptor(
        eserviceId,
        descriptorId,
        seed,
        readModelService,
        repository,
        ctx
      );
    },

    async updateDraftDescriptorTemplateInstance(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
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

      assertConsistentDailyCalls(seed);

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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
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

      if (
        isFeatureFlagEnabled(config, "featureFlagEservicePersonalData") &&
        eservice.data.personalData === undefined
      ) {
        throw missingPersonalDataFlag(eserviceId, descriptorId);
      }

      if (producerDelegation) {
        const eserviceWithWaitingForApprovalDescriptor = replaceDescriptor(
          eservice.data,
          updateDescriptorState(descriptor, descriptorState.waitingForApproval)
        );
        const event = await repository.createEvent(
          toCreateEventEServiceDescriptorSubmittedByDelegate(
            eservice.metadata.version,
            descriptor.id,
            eserviceWithWaitingForApprovalDescriptor,
            correlationId
          )
        );
        return {
          data: eserviceWithWaitingForApprovalDescriptor,
          metadata: {
            version: event.newVersion,
          },
        };
      } else {
        const updatedEService = await processDescriptorPublication(
          eservice.data,
          descriptor,
          readModelService,
          logger
        );

        const event = await repository.createEvent(
          toCreateEventEServiceDescriptorPublished(
            eserviceId,
            eservice.metadata.version,
            descriptorId,
            updatedEService,
            correlationId
          )
        );
        return {
          data: updatedEService,
          metadata: {
            version: event.newVersion,
          },
        };
      }
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
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

      const event = await repository.createEvent(
        toCreateEventEServiceDescriptorSuspended(
          eserviceId,
          eservice.metadata.version,
          descriptorId,
          newEservice,
          correlationId
        )
      );

      return {
        data: newEservice,
        metadata: {
          version: event.newVersion,
        },
      };
    },

    async activateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
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
      const createActivationEvent = async () => {
        if (
          recentDescriptorVersion !== null &&
          parseInt(descriptor.version, 10) === recentDescriptorVersion
        ) {
          const newEservice = replaceDescriptor(
            eservice.data,
            updatedDescriptor
          );

          const event = await repository.createEvent(
            toCreateEventEServiceDescriptorActivated(
              eserviceId,
              eservice.metadata.version,
              descriptorId,
              newEservice,
              correlationId
            )
          );

          return {
            data: newEservice,
            metadata: {
              version: event.newVersion,
            },
          };
        } else {
          const newEservice = replaceDescriptor(
            eservice.data,
            deprecateDescriptor(eserviceId, descriptor, logger)
          );

          const event = await repository.createEvent(
            toCreateEventEServiceDescriptorActivated(
              eserviceId,
              eservice.metadata.version,
              descriptorId,
              newEservice,
              correlationId
            )
          );
          return {
            data: newEservice,
            metadata: {
              version: event.newVersion,
            },
          };
        }
      };

      const response = await createActivationEvent();

      return {
        data: response.data,
        metadata: {
          version: response.metadata.version,
        },
      };
    },

    async cloneDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );

      assertRequesterIsProducer(eservice.data.producerId, authData);
      await assertNoExistingProducerDelegationInActiveOrPendingState(
        eservice.data.id,
        readModelService
      );

      const clonedEServiceName = `${
        eservice.data.name
      } - clone - ${formatDateddMMyyyyHHmmss(new Date())}`;

      await assertEServiceNameAvailableForProducer(
        clonedEServiceName,
        eservice.data.producerId,
        readModelService
      );

      await assertEServiceNameNotConflictingWithTemplate(
        clonedEServiceName,
        readModelService
      );

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
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<void> {
      logger.info(
        `Archiving Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      assertDescriptorUpdatableAfterPublish(descriptor);
      assertConsistentDailyCalls(seed);

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

      const event = await repository.createEvent(
        toCreateEventEServiceDescriptorQuotasUpdated(
          eserviceId,
          eservice.metadata.version,
          descriptorId,
          updatedEService,
          correlationId
        )
      );

      return {
        data: updatedEService,
        metadata: { version: event.newVersion },
      };
    },
    async updateTemplateInstanceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<EService> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId} template instance`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceIsTemplateInstance(eservice.data);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);

      assertDescriptorUpdatableAfterPublish(descriptor);
      assertConsistentDailyCalls(seed);

      const updatedEService = replaceDescriptor(eservice.data, {
        ...descriptor,
        dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
        dailyCallsTotal: seed.dailyCallsTotal,
      });

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
    async updateAgreementApprovalPolicy(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<EService> {
      assertFeatureFlagEnabled(
        config,
        "featureFlagAgreementApprovalPolicyUpdate"
      );

      logger.info(
        `Updating Agreement approval policy of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      assertDescriptorUpdatableAfterPublish(descriptor);

      const updatedDescriptor: Descriptor = {
        ...descriptor,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.agreementApprovalPolicy
          ),
      };

      const updatedEService = replaceDescriptor(
        eservice.data,
        updatedDescriptor
      );

      const event =
        toCreateEventEServiceDescriptorAgreementApprovalPolicyUpdated(
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<{
        eservice: EService;
        createdRiskAnalysisId: RiskAnalysisId;
      }>
    > {
      logger.info(`Creating Risk Analysis for EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
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
        tenant.kind,
        new Date(), // drawback: the date of the risk analysis is set below in the function riskAnalysisValidatedFormToNewRiskAnalysis
        eservice.data.personalData
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

      const createdEvent = await repository.createEvent(event);

      return {
        data: {
          eservice: newEservice,
          createdRiskAnalysisId: newRiskAnalysis.id,
        },
        metadata: { version: createdEvent.newVersion },
      };
    },
    async updateRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysis["id"],
      eserviceRiskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Updating Risk Analysis ${riskAnalysisId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
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
        tenant.kind,
        new Date(), // drawback: the date of the risk analysis is replaced below in the function riskAnalysisValidatedFormToNewRiskAnalysis
        eservice.data.personalData
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(
        `Deleting Risk Analysis ${riskAnalysisId} for EService ${eserviceId}`
      );
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
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

      const event = await repository.createEvent(
        toCreateEventEServiceRiskAnalysisDeleted(
          eservice.data.id,
          eservice.metadata.version,
          riskAnalysisId,
          eserviceWithRiskAnalysisDeleted,
          correlationId
        )
      );

      return {
        data: eserviceWithRiskAnalysisDeleted,
        metadata: { version: event.newVersion },
      };
    },
    async updateEServiceDescription(
      eserviceId: EServiceId,
      description: string,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(`Updating EService ${eserviceId} description`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceUpdatableAfterPublish(eservice.data);

      const updatedEservice: EService = {
        ...eservice.data,
        description,
      };

      const event = await repository.createEvent(
        toCreateEventEServiceDescriptionUpdated(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        )
      );
      return {
        data: updatedEservice,
        metadata: { version: event.newVersion },
      };
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
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(`Updating EService ${eserviceId} delegation flags`);
      const eservice = await retrieveEService(eserviceId, readModelService);
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceUpdatableAfterPublish(eservice.data);

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
        const createdEvents = await repository.createEvents(events);

        return {
          data: updatedEservice,
          metadata: {
            version:
              createdEvents.latestNewVersion.get(events[0].streamId) ?? 0,
          },
        };
      }
      return eservice;
    },
    async updateEServiceName(
      eserviceId: EServiceId,
      name: string,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(`Updating name of EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );
      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceUpdatableAfterPublish(eservice.data);

      if (name !== eservice.data.name) {
        await assertEServiceNameAvailableForProducer(
          name,
          eservice.data.producerId,
          readModelService
        );

        await assertEServiceNameNotConflictingWithTemplate(
          name,
          readModelService
        );
      }

      const updatedEservice: EService = {
        ...eservice.data,
        name,
      };

      const event = await repository.createEvent(
        toCreateEventEServiceNameUpdated(
          eservice.metadata.version,
          updatedEservice,
          eservice.data.name,
          correlationId
        )
      );
      return {
        data: updatedEservice,
        metadata: {
          version: event.newVersion,
        },
      };
    },

    async updateEServiceSignalHubFlag(
      eserviceId: EServiceId,
      isSignalHubEnabled: boolean,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(
        `Updating Signalhub flag for E-Service ${eserviceId} to ${isSignalHubEnabled}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceUpdatableAfterPublish(eservice.data);

      const updatedEservice: EService = {
        ...eservice.data,
        isSignalHubEnabled,
      };

      const event = match({
        newisSignalHubEnabled: isSignalHubEnabled,
        oldSignalHubEnabled: eservice.data.isSignalHubEnabled || false,
      })
        .with(
          {
            oldSignalHubEnabled: false,
            newisSignalHubEnabled: true,
          },
          () =>
            toCreateEventEServiceSignalhubFlagEnabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            )
        )
        .with(
          {
            oldSignalHubEnabled: true,
            newisSignalHubEnabled: false,
          },
          () =>
            toCreateEventEServiceSignalhubFlagDisabled(
              eservice.metadata.version,
              updatedEservice,
              correlationId
            )
        )
        .with(
          {
            oldSignalHubEnabled: true,
            newisSignalHubEnabled: true,
          },
          {
            oldSignalHubEnabled: false,
            newisSignalHubEnabled: false,
          },
          () => null
        )
        .exhaustive();

      if (event) {
        const createdEvent = await repository.createEvent(event);

        return {
          data: updatedEservice,
          metadata: {
            version: createdEvent.newVersion,
          },
        };
      }
      return eservice;
    },
    async approveDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
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

      if (
        isFeatureFlagEnabled(config, "featureFlagEservicePersonalData") &&
        eservice.data.personalData === undefined
      ) {
        throw missingPersonalDataFlag(eserviceId, descriptorId);
      }

      const updatedEService = await processDescriptorPublication(
        eservice.data,
        descriptor,
        readModelService,
        logger
      );

      const event = await repository.createEvent(
        toCreateEventEServiceDescriptorApprovedByDelegator(
          eservice.metadata.version,
          descriptor.id,
          updatedEService,
          correlationId
        )
      );
      return {
        data: updatedEService,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async rejectDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      body: catalogApi.RejectDelegatedEServiceDescriptorSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
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

      const event = await repository.createEvent(
        toCreateEventEServiceDescriptorRejectedByDelegator(
          eservice.metadata.version,
          descriptor.id,
          updatedEService,
          correlationId
        )
      );
      return {
        data: updatedEService,
        metadata: {
          version: event.newVersion,
        },
      };
    },
    async updateDescriptorAttributes(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.AttributesSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EService>> {
      logger.info(
        `Updating attributes of Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      assertEServiceNotTemplateInstance(
        eservice.data.id,
        eservice.data.templateId
      );

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eserviceId,
        authData,
        readModelService
      );

      const descriptor = retrieveDescriptor(descriptorId, eservice);
      assertDescriptorUpdatableAfterPublish(descriptor);

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

      const createdEvent = await repository.createEvent(
        toCreateEventEServiceDescriptorAttributesUpdated(
          eservice.metadata.version,
          descriptor.id,
          newAttributes,
          updatedEService,
          correlationId
        )
      );

      return {
        data: updatedEService,
        metadata: { version: createdEvent.newVersion },
      };
    },
    async internalUpdateTemplateInstanceName(
      eserviceId: EServiceId,
      newName: string,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Internal updating name of EService ${eserviceId}`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      if (newName === eservice.data.name) {
        return;
      }

      await assertEServiceNameAvailableForProducer(
        newName,
        eservice.data.producerId,
        readModelService
      );

      const updatedEservice: EService = {
        ...eservice.data,
        name: newName,
      };

      await repository.createEvent(
        toCreateEventEServiceNameUpdatedByTemplateUpdate(
          eservice.metadata.version,
          updatedEservice,
          eservice.data.name,
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
    async internalUpdateTemplateInstancePersonalDataFlag(
      eserviceId: EServiceId,
      personalData: boolean,
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Internal updating EService ${eserviceId} personalData`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      if (eservice.data.personalData !== undefined) {
        return;
      }

      const updatedEservice: EService = {
        ...eservice.data,
        personalData,
      };
      await repository.createEvent(
        toCreateEventEServicePersonalDataFlagUpdatedByTemplateUpdate(
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
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Descriptor> {
      logger.info(`Upgrading EService ${eserviceId} instance`);

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      const templateId = eservice.data.templateId;
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

      const newDescriptor: Descriptor = createNextDescriptor(eservice.data, {
        description: lastVersion.description,
        voucherLifespan: lastVersion.voucherLifespan,
        audience: [],
        dailyCallsPerConsumer: lastVersion.dailyCallsPerConsumer ?? 1,
        dailyCallsTotal: lastVersion.dailyCallsTotal ?? 1,
        agreementApprovalPolicy: lastVersion.agreementApprovalPolicy,
        attributes: lastVersion.attributes,
        docs,
        templateVersionId: lastVersion.id,
      });

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

      return newDescriptor;
    },
    async createEServiceInstanceFromTemplate(
      templateId: EServiceTemplateId,
      seed: catalogApi.InstanceEServiceSeed,
      ctx: WithLogger<AppContext<UIAuthData>>
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

      const riskAnalysis = await match(template)
        .with({ mode: eserviceMode.receive }, (template) =>
          extractEServiceRiskAnalysisFromTemplate(
            template,
            ctx.authData.organizationId,
            readModelService
          )
        )
        .with({ mode: eserviceMode.deliver }, () => Promise.resolve([]))
        .exhaustive();

      await assertEServiceNameAvailableForProducer(
        template.name,
        ctx.authData.organizationId,
        readModelService
      );

      if (
        isFeatureFlagEnabled(config, "featureFlagEservicePersonalData") &&
        template.personalData === undefined
      ) {
        throw eServiceTemplateWithoutPersonalDataFlag(
          template.id,
          publishedVersion.id
        );
      }

      const { eService: createdEService, events } = await innerCreateEService(
        {
          seed: {
            name: template.name,
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
            personalData: template.personalData,
          },
          template: {
            id: template.id,
            versionId: publishedVersion.id,
            attributes: publishedVersion.attributes,
            riskAnalysis,
          },
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
      eserviceInstanceInterfaceData:
        | catalogApi.TemplateInstanceInterfaceRESTSeed
        | catalogApi.TemplateInstanceInterfaceSOAPSeed,
      ctx: WithLogger<AppContext<UIAuthData>>
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
      assertIsDraftDescriptor(descriptor);

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

      const eserviceTemplateVersion = eserviceTemplate.versions.find(
        (v) => v.id === eserviceTemplateVersionId
      );
      const templateInterface = eserviceTemplateVersion?.interface;
      if (!templateInterface) {
        throw eserviceTemplateInterfaceNotFound(
          eserviceTemplateId,
          eserviceTemplateVersionId
        );
      }

      const contactDataRestApi = match(eserviceInstanceInterfaceData)
        .with({ contactEmail: P.string, contactName: P.string }, (data) => data)
        .otherwise(() => undefined);

      const { eService: updatedEService, event: addDocumentEvent } =
        await createOpenApiInterfaceByTemplate(
          eserviceWithMetadata,
          descriptor.id,
          templateInterface,
          eserviceInstanceInterfaceData.serverUrls,
          contactDataRestApi,
          config.eserviceTemplateDocumentsContainer,
          fileManager,
          ctx
        );

      await repository.createEvent(addDocumentEvent);

      return updatedEService;
    },
    async createTemplateInstanceDescriptor(
      eserviceId: EServiceId,
      eserviceInstanceDescriptorSeed: catalogApi.EServiceInstanceDescriptorSeed,
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<Descriptor> {
      ctx.logger.info(
        `Creating Instance Descriptor for EService ${eserviceId}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        ctx.authData,
        readModelService
      );

      assertHasNoDraftOrWaitingForApprovalDescriptor(eservice.data);
      assertEServiceIsTemplateInstance(eservice.data);

      const template = await retrieveEServiceTemplate(
        eservice.data.templateId,
        readModelService
      );

      const latestDescriptor = getLatestDescriptor(eservice.data);

      if (!latestDescriptor) {
        throw eserviceWithoutValidDescriptors(eserviceId);
      }

      const templateVersion = template.versions.find(
        (v) => v.id === latestDescriptor.templateVersionRef?.id
      );

      if (!templateVersion) {
        throw descriptorTemplateVersionNotFound(
          latestDescriptor.id,
          eservice.data.id,
          template.id
        );
      }

      const agreementApprovalPolicySeed =
        eserviceInstanceDescriptorSeed.agreementApprovalPolicy
          ? apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              eserviceInstanceDescriptorSeed.agreementApprovalPolicy
            )
          : undefined;

      assertConsistentDailyCalls(eserviceInstanceDescriptorSeed);

      const newDescriptor: Descriptor = createNextDescriptor(eservice.data, {
        description: templateVersion.description,
        voucherLifespan: templateVersion.voucherLifespan,
        audience: eserviceInstanceDescriptorSeed.audience,
        dailyCallsPerConsumer:
          eserviceInstanceDescriptorSeed.dailyCallsPerConsumer,
        dailyCallsTotal: eserviceInstanceDescriptorSeed.dailyCallsTotal,
        agreementApprovalPolicy:
          agreementApprovalPolicySeed ??
          templateVersion.agreementApprovalPolicy ??
          agreementApprovalPolicy.automatic,
        docs: [],
        attributes: templateVersion.attributes,
        templateVersionId: templateVersion.id,
      });

      const eserviceVersion = eservice.metadata.version;

      const updatedEservice: EService = {
        ...eservice.data,
        descriptors: [...eservice.data.descriptors, newDescriptor],
      };

      const descriptorCreationEvent = toCreateEventEServiceDescriptorAdded(
        updatedEservice,
        eserviceVersion,
        newDescriptor.id,
        ctx.correlationId
      );

      const { updatedDescriptor, events } = await templateVersion.docs.reduce(
        async (accPromise, doc, index) => {
          const acc = await accPromise;

          const clonedDocumentId = generateId<EServiceDocumentId>();
          const clonedDocumentPath = await fileManager.copy(
            config.s3Bucket,
            doc.path,
            config.eserviceDocumentsPath,
            clonedDocumentId,
            doc.name,
            ctx.logger
          );

          const { eService, descriptor, event } =
            await innerAddDocumentToEserviceEvent(
              { data: acc.lastEService, metadata: { version: index + 1 } },
              acc.updatedDescriptor.id,
              {
                documentId: clonedDocumentId,
                kind: "DOCUMENT",
                prettyName: doc.prettyName,
                filePath: clonedDocumentPath,
                fileName: doc.name,
                contentType: doc.contentType,
                checksum: doc.checksum,
                serverUrls: [],
              },
              ctx
            );

          return {
            lastEService: eService,
            updatedDescriptor: descriptor,
            events: [...acc.events, event],
          };
        },
        Promise.resolve({
          lastEService: updatedEservice,
          updatedDescriptor: newDescriptor,
          events: [descriptorCreationEvent],
        })
      );

      await repository.createEvents(events);

      return updatedDescriptor;
    },
    async updateEServicePersonalDataFlagAfterPublication(
      eserviceId: EServiceId,
      personalData: boolean,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<EService> {
      logger.info(
        `Setting personalData flag for E-Service ${eserviceId} to ${personalData}`
      );

      const eservice = await retrieveEService(eserviceId, readModelService);

      await assertRequesterIsDelegateProducerOrProducer(
        eservice.data.producerId,
        eservice.data.id,
        authData,
        readModelService
      );

      assertEServiceNotTemplateInstance(eserviceId, eservice.data.templateId);

      assertEServiceUpdatableAfterPublish(eservice.data);

      if (eservice.data.personalData !== undefined) {
        throw eservicePersonalDataFlagCanOnlyBeSetOnce(eserviceId);
      }

      const updatedEservice: EService = {
        ...eservice.data,
        personalData,
      };

      const event =
        toCreateEventEServicePersonalDataFlagUpdatedAfterPublication(
          eservice.metadata.version,
          updatedEservice,
          correlationId
        );

      await repository.createEvent(event);

      return updatedEservice;
    },
  };
}

async function createOpenApiInterfaceByTemplate(
  eserviceWithMetadata: WithMetadata<EService>,
  descriptorId: DescriptorId,
  eserviceTemplateInterface: Document,
  serverUrls: string[],
  eserviceInstanceInterfaceRestData:
    | {
        contactEmail: string;
        contactName: string;
        contactUrl?: string;
        termsAndConditionsUrl?: string;
      }
    | undefined,
  bucket: string,
  fileManager: FileManager,
  ctx: WithLogger<AppContext<UIAuthData>>
): Promise<{ eService: EService; event: CreateEvent<EServiceEvent> }> {
  const eservice = eserviceWithMetadata.data;
  const interfaceTemplate = await fileManager.get(
    bucket,
    eserviceTemplateInterface.path,
    ctx.logger
  );

  if (serverUrls.length < 1) {
    throw eserviceInterfaceDataNotValid();
  }

  const documentId = unsafeBrandId<EServiceDocumentId>(randomUUID());
  const newInterfaceFile = await interpolateTemplateApiSpec(
    eservice,
    Buffer.from(interfaceTemplate).toString(),
    eserviceTemplateInterface,
    serverUrls,
    eserviceInstanceInterfaceRestData
  );

  return await verifyAndCreateDocument(
    fileManager,
    { id: eservice.id, isEserviceTemplate: true },
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
          interfaceTemplateMetadata: eserviceInstanceInterfaceRestData,
        },
        ctx
      ),
    ctx.logger
  );
}

async function applyVisibilityToEService(
  eservice: EService,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData | InternalAuthData,
  readModelService: ReadModelServiceSQL
): Promise<EService> {
  if (authData.systemRole === authRole.INTERNAL_ROLE) {
    return eservice;
  }

  if (hasRoleToAccessInactiveDescriptors(authData)) {
    /* Inactive descriptors are visible only if both conditions are met:
       1) The request is made with a role that can access inactive descriptors.
          (see the condition above)
       2) The request originates from the producer tenant or a delegate producer tenant.
          (see the following code)
    */
    if (authData.organizationId === eservice.producerId) {
      return eservice;
    }

    const producerDelegation = await readModelService.getLatestDelegation({
      eserviceId: eservice.id,
      states: [delegationState.active, delegationState.waitingForApproval],
      kind: delegationKind.delegatedProducer,
    });

    if (authData.organizationId === producerDelegation?.delegateId) {
      return eservice;
    }
  }

  /* If the conditions above are not met:
    - we filter out the draft descriptors.
    - we throw a not found error if there are no active descriptors
  */
  const hasActiveDescriptors = eservice.descriptors.some(isActiveDescriptor);
  if (hasActiveDescriptors) {
    return {
      ...eservice,
      descriptors: eservice.descriptors.filter(isActiveDescriptor),
    };
  }

  throw eServiceNotFound(eservice.id);
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
  readModelService: ReadModelServiceSQL,
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

function evaluateTemplateVersionRef(
  descriptor: Descriptor,
  documentSeed: catalogApi.CreateEServiceDescriptorDocumentSeed
): Descriptor["templateVersionRef"] {
  if (
    documentSeed.kind !== "INTERFACE" ||
    !descriptor.templateVersionRef ||
    !documentSeed.interfaceTemplateMetadata
  ) {
    return descriptor.templateVersionRef;
  }

  const { contactEmail, contactName, contactUrl, termsAndConditionsUrl } =
    documentSeed.interfaceTemplateMetadata;

  return {
    id: descriptor.templateVersionRef.id,
    interfaceMetadata: {
      contactEmail,
      contactName,
      contactUrl,
      termsAndConditionsUrl,
    },
  };
}

async function extractEServiceRiskAnalysisFromTemplate(
  template: EServiceTemplate & { mode: typeof eserviceMode.receive },
  requester: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<RiskAnalysis[]> {
  const tenant = await retrieveTenant(requester, readModelService);

  assertTenantKindExists(tenant);

  const riskAnalysis: RiskAnalysis[] = template.riskAnalysis
    .filter((r) =>
      match(tenant.kind)
        .with(tenantKind.PA, () => r.tenantKind === tenantKind.PA)
        .with(
          tenantKind.GSP,
          tenantKind.PRIVATE,
          tenantKind.SCP,
          () =>
            r.tenantKind === tenantKind.GSP ||
            r.tenantKind === tenantKind.PRIVATE ||
            r.tenantKind === tenantKind.SCP
          /**
           * For now, GSP, PRIVATE, and SCP tenants share the same risk analysis.
           * This may change in the future.
           */
        )
        .exhaustive()
    )
    .map(
      (r) =>
        ({
          id: r.id,
          createdAt: r.createdAt,
          name: r.name,
          riskAnalysisForm: r.riskAnalysisForm,
        } satisfies RiskAnalysis)
    );

  if (riskAnalysis.length === 0) {
    throw templateMissingRequiredRiskAnalysis(
      template.id,
      tenant.id,
      tenant.kind
    );
  }

  return riskAnalysis;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function updateDraftEService(
  eserviceId: EServiceId,
  typeAndSeed:
    | {
        type: "put";
        seed: catalogApi.UpdateEServiceSeed;
      }
    | {
        type: "patch";
        seed: catalogApi.PatchUpdateEServiceSeed;
      },
  readModelService: ReadModelServiceSQL,
  fileManager: FileManager,
  repository: ReturnType<typeof eventRepository<EServiceEvent>>,
  {
    authData,
    logger,
    correlationId,
  }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
): Promise<WithMetadata<EService>> {
  const eservice = await retrieveEService(eserviceId, readModelService);
  await assertRequesterIsDelegateProducerOrProducer(
    eservice.data.producerId,
    eservice.data.id,
    authData,
    readModelService
  );
  assertEServiceNotTemplateInstance(eservice.data.id, eservice.data.templateId);

  assertIsDraftEservice(eservice.data);

  const {
    name,
    description,
    technology,
    mode,
    isSignalHubEnabled,
    isConsumerDelegable,
    isClientAccessDelegable,
  } = typeAndSeed.seed;

  if (name && name !== eservice.data.name) {
    await assertEServiceNameAvailableForProducer(
      name,
      eservice.data.producerId,
      readModelService
    );
    await assertEServiceNameNotConflictingWithTemplate(name, readModelService);
  }

  const updatedTechnology = technology
    ? apiTechnologyToTechnology(technology)
    : eservice.data.technology;

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

  const updatedMode = mode
    ? apiEServiceModeToEServiceMode(mode)
    : eservice.data.mode;

  // delete risk analysis in one of these cases:
  // - mode is changed to "Deliver"
  // - personalData flag is changed from true to false or vice versa
  const checkedRiskAnalysis =
    updatedMode === eserviceMode.deliver ||
    (typeAndSeed.seed.personalData != null &&
      eservice.data.personalData != null &&
      typeAndSeed.seed.personalData !== eservice.data.personalData)
      ? []
      : eservice.data.riskAnalysis;

  const updatedIsSignalHubEnabled = match(typeAndSeed.type)
    .with("put", () => isSignalHubEnabled)
    .with("patch", () => isSignalHubEnabled ?? eservice.data.isSignalHubEnabled)
    .exhaustive();

  const updatedIsConsumerDelegable = match(typeAndSeed.type)
    .with("put", () => isConsumerDelegable)
    .with(
      "patch",
      () => isConsumerDelegable ?? eservice.data.isConsumerDelegable
    )
    .exhaustive();

  const updatedIsClientAccessDelegable = match(typeAndSeed.type)
    .with("put", () => isClientAccessDelegable)
    .with(
      "patch",
      () => isClientAccessDelegable ?? eservice.data.isClientAccessDelegable
    )
    .exhaustive();

  const updatedPersonalData = match(typeAndSeed)
    .with({ type: "put" }, ({ seed }) => seed.personalData)
    .with(
      { type: "patch" },
      ({ seed }) =>
        seed.personalData ??
        (seed.personalData === null ? undefined : eservice.data.personalData)
    )
    .exhaustive();

  const updatedEService: EService = {
    ...eservice.data,
    description: description ?? eservice.data.description,
    name: name ?? eservice.data.name,
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
    isSignalHubEnabled: isFeatureFlagEnabled(
      config,
      "featureFlagSignalhubWhitelist"
    )
      ? isTenantInSignalHubWhitelist(
          authData.organizationId,
          updatedIsSignalHubEnabled
        )
      : updatedIsSignalHubEnabled,
    isConsumerDelegable: updatedIsConsumerDelegable,
    isClientAccessDelegable: match(updatedIsConsumerDelegable)
      .with(P.nullish, () => undefined)
      .with(false, () => false)
      .with(true, () => updatedIsClientAccessDelegable)
      .exhaustive(),
    ...(isFeatureFlagEnabled(config, "featureFlagEservicePersonalData")
      ? { personalData: updatedPersonalData }
      : {}),
  };

  const event = await repository.createEvent(
    toCreateEventEServiceUpdated(
      eserviceId,
      eservice.metadata.version,
      updatedEService,
      correlationId
    )
  );

  return { data: updatedEService, metadata: { version: event.newVersion } };
}

async function updateDraftDescriptor(
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  seed:
    | catalogApi.UpdateEServiceDescriptorSeed
    | catalogApi.PatchUpdateEServiceDescriptorSeed,
  readModelService: ReadModelServiceSQL,
  repository: ReturnType<typeof eventRepository<EServiceEvent>>,
  {
    authData,
    correlationId,
  }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
): Promise<WithMetadata<EService>> {
  const eservice = await retrieveEService(eserviceId, readModelService);
  await assertRequesterIsDelegateProducerOrProducer(
    eservice.data.producerId,
    eservice.data.id,
    authData,
    readModelService
  );
  assertEServiceNotTemplateInstance(eservice.data.id, eservice.data.templateId);
  const descriptor = retrieveDescriptor(descriptorId, eservice);

  assertIsDraftDescriptor(descriptor);

  const {
    description,
    audience,
    voucherLifespan,
    dailyCallsPerConsumer,
    dailyCallsTotal,
    agreementApprovalPolicy,
    attributes,
    ...rest
  } = seed;
  void (rest satisfies Record<string, never>);
  // ^ To make sure we extract all the updated fields

  const updatedDailyCallsPerConsuemer =
    dailyCallsPerConsumer ?? descriptor.dailyCallsPerConsumer;
  const updatedDailyCallsTotal = dailyCallsTotal ?? descriptor.dailyCallsTotal;

  assertConsistentDailyCalls({
    dailyCallsPerConsumer: updatedDailyCallsPerConsuemer,
    dailyCallsTotal: updatedDailyCallsTotal,
  });

  const updatedAttributes = attributes
    ? await parseAndCheckAttributes(
        {
          certified: attributes.certified ?? descriptor.attributes.certified,
          declared: attributes.declared ?? descriptor.attributes.declared,
          verified: attributes.verified ?? descriptor.attributes.verified,
        },
        readModelService
      )
    : descriptor.attributes;

  const updatedAgreementApprovalPolicy = agreementApprovalPolicy
    ? apiAgreementApprovalPolicyToAgreementApprovalPolicy(
        agreementApprovalPolicy
      )
    : descriptor.agreementApprovalPolicy;

  const updatedDescriptor: Descriptor = {
    ...descriptor,
    description: description ?? descriptor.description,
    audience: audience ?? descriptor.audience,
    voucherLifespan: voucherLifespan ?? descriptor.voucherLifespan,
    dailyCallsPerConsumer: updatedDailyCallsPerConsuemer,
    dailyCallsTotal: updatedDailyCallsTotal,
    agreementApprovalPolicy: updatedAgreementApprovalPolicy,
    attributes: updatedAttributes,
  };

  const updatedEService = replaceDescriptor(eservice.data, updatedDescriptor);

  const event = await repository.createEvent(
    toCreateEventEServiceDraftDescriptorUpdated(
      eserviceId,
      eservice.metadata.version,
      descriptorId,
      updatedEService,
      correlationId
    )
  );
  return {
    data: updatedEService,
    metadata: { version: event.newVersion },
  };
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
