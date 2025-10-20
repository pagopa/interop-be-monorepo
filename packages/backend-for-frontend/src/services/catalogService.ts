/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import {
  bffApi,
  catalogApi,
  delegationApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  FileManager,
  WithLogger,
  createPollingByCondition,
  formatDateyyyyMMddThhmmss,
  getAllFromPaginated,
  verifyAndCreateDocument,
  verifyAndCreateImportedDocument,
} from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  EServiceTemplateId,
  RiskAnalysisId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  apiTechnologyToTechnology,
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
  toBffCatalogApiEService,
  toBffCatalogApiEserviceRiskAnalysis,
  toBffCatalogApiEserviceRiskAnalysisSeed,
  toBffCatalogApiProducerDescriptorEService,
  toBffCatalogDescriptorEService,
  toBffEServiceTemplateInstance,
  toCatalogCreateEServiceSeed,
  toCompactProducerDescriptor,
} from "../api/catalogApiConverter.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
  EServiceTemplateProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { BffProcessConfig, config } from "../config/config.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidZipStructure,
  missingDescriptorInClonedEservice,
  noDescriptorInEservice,
  tenantNotFound,
} from "../model/errors.js";
import {
  getLatestActiveDescriptor,
  getLatestTenantContactEmail,
} from "../model/modelMappingUtils.js";
import { ConfigurationEservice } from "../model/types.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import {
  cloneEServiceDocument,
  createDescriptorDocumentZipFile,
} from "../utilities/fileUtils.js";
import { getAllAgreements, getLatestAgreement } from "./agreementService.js";
import { getAllBulkAttributes } from "./attributeService.js";
import {
  getAllDelegations,
  getTenantsFromDelegation,
} from "./delegationService.js";
import {
  assertEServiceNotTemplateInstance,
  assertNotDelegatedEservice,
  assertRequesterCanActAsProducer,
  assertRequesterIsProducer,
  isInvalidDescriptor,
} from "./validators.js";
import { retrieveEServiceTemplate } from "./eserviceTemplateService.js";

export const enhanceCatalogEservices = async (
  eservices: catalogApi.EService[],
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  headers: Headers,
  requesterId: TenantId
): Promise<bffApi.CatalogEService[]> => {
  const tenantsIds = new Set([
    ...eservices.map((e) => e.producerId),
    requesterId,
  ] as TenantId[]);

  const cachedTenants = new Map(
    await Promise.all(
      Array.from(tenantsIds).map(
        async (tenantId): Promise<[TenantId, tenantApi.Tenant]> => [
          tenantId,
          await tenantProcessClient.tenant.getTenant({
            headers,
            params: { id: tenantId },
          }),
        ]
      )
    )
  );

  const getCachedTenant = (tenantId: TenantId): tenantApi.Tenant => {
    const tenant = cachedTenants.get(tenantId);
    if (!tenant) {
      throw tenantNotFound(tenantId);
    }
    return tenant;
  };
  const enhanceEService =
    (
      agreementProcessClient: AgreementProcessClient,
      headers: Headers,
      requesterId: TenantId
    ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
    async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
      const producerTenant = getCachedTenant(eservice.producerId as TenantId);

      const latestActiveDescriptor = getLatestActiveDescriptor(eservice);

      const latestAgreement = await getLatestAgreement(
        agreementProcessClient,
        requesterId,
        eservice,
        headers
      );

      const isRequesterEqProducer = requesterId === eservice.producerId;

      return toBffCatalogApiEService(
        eservice,
        producerTenant,
        isRequesterEqProducer,
        latestActiveDescriptor,
        latestAgreement
      );
    };

  return await Promise.all(
    eservices.map(enhanceEService(agreementProcessClient, headers, requesterId))
  );
};

const checkNewTemplateVersionAvailable = (
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  activeDescriptor: catalogApi.EServiceDescriptor
): boolean => {
  const eserviceTemplateVersion = eserviceTemplate?.versions.find(
    (v) => v.id === activeDescriptor?.templateVersionRef?.id
  );

  return Boolean(
    eserviceTemplateVersion &&
      eserviceTemplate?.versions.some(
        (v) =>
          v.version > eserviceTemplateVersion?.version &&
          v.state ===
            eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED
      )
  );
};

const enhanceProducerEService = (
  eservice: catalogApi.EService,
  requesterId: TenantId,
  delegations: delegationApi.Delegation[],
  delegationTenants: Map<string, tenantApi.Tenant>,
  eserviceTemplates: eserviceTemplateApi.EServiceTemplate[]
): bffApi.ProducerEService => {
  const activeDescriptor = getLatestActiveDescriptor(eservice);
  const draftDescriptor = eservice.descriptors.find(isInvalidDescriptor);

  const isRequesterDelegateProducer = requesterId !== eservice.producerId;

  const delegation = delegations.find((d) => d.eserviceId === eservice.id);
  const delegator =
    delegation !== undefined
      ? delegationTenants.get(delegation.delegatorId)
      : undefined;
  const delegate =
    delegation !== undefined
      ? delegationTenants.get(delegation.delegateId)
      : undefined;

  const eserviceTemplate = eserviceTemplates.find(
    (t) => t.id === eservice.templateId
  );

  return {
    id: eservice.id,
    name: eservice.name,
    mode: eservice.mode,
    activeDescriptor: activeDescriptor
      ? toCompactProducerDescriptor(
          activeDescriptor,
          isRequesterDelegateProducer
        )
      : undefined,
    draftDescriptor: draftDescriptor
      ? toCompactProducerDescriptor(
          draftDescriptor,
          isRequesterDelegateProducer
        )
      : undefined,
    delegation:
      delegation !== undefined &&
      delegator !== undefined &&
      delegate !== undefined
        ? {
            id: delegation.id,
            delegator: {
              id: delegator.id,
              name: delegator.name,
              kind: delegator.kind,
              contactMail: getLatestTenantContactEmail(delegator),
            },
            delegate: {
              id: delegate.id,
              name: delegate.name,
              kind: delegate.kind,
              contactMail: getLatestTenantContactEmail(delegate),
            },
          }
        : undefined,
    isTemplateInstance: eserviceTemplate !== undefined,
    isNewTemplateVersionAvailable:
      eserviceTemplate !== undefined &&
      activeDescriptor !== undefined &&
      checkNewTemplateVersionAvailable(eserviceTemplate, activeDescriptor),
  };
};

export const retrieveEserviceDescriptor = (
  eservice: catalogApi.EService,
  descriptorId: DescriptorId
): catalogApi.EServiceDescriptor => {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

const retrieveRiskAnalysis = (
  eservice: catalogApi.EService,
  riskAnalysisId: RiskAnalysisId
): catalogApi.EServiceRiskAnalysis => {
  const riskAnalysis = eservice.riskAnalysis.find(
    (ra) => ra.id === riskAnalysisId
  );

  if (!riskAnalysis) {
    throw eserviceRiskNotFound(eservice.id, riskAnalysisId);
  }
  return riskAnalysis;
};

const getAttributeIds = (
  descriptor: catalogApi.EServiceDescriptor
): string[] => [
  ...descriptor.attributes.certified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.declared.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.verified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
];

export const getAllEserviceConsumers = async (
  catalogProcessClient: CatalogProcessClient,
  headers: Headers,
  eServiceId: EServiceId
): Promise<catalogApi.EServiceConsumer[]> =>
  await getAllFromPaginated(async (offset, limit) =>
    catalogProcessClient.getEServiceConsumers({
      headers,
      params: {
        eServiceId,
      },
      queries: { offset, limit },
    })
  );

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  attributeProcessClient: AttributeProcessClient,
  delegationProcessClient: DelegationProcessClient,
  eserviceTemplateProcessClient: EServiceTemplateProcessClient,
  fileManager: FileManager,
  bffConfig: BffProcessConfig
) {
  return {
    getCatalog: async (
      { headers, authData, logger }: WithLogger<BffAppContext>,
      queries: catalogApi.GetEServicesQueryParams
    ): Promise<bffApi.CatalogEServices> => {
      const {
        offset,
        limit,
        producersIds,
        states,
        attributesIds,
        name,
        mode,
        agreementStates,
        isConsumerDelegable,
        personalData,
      } = queries;
      logger.info(
        `Retrieving EServices for name = ${name}, producersIds = ${producersIds}, attributesIds = ${attributesIds}, states = ${states}, agreementStates = ${agreementStates}, isConsumerDelegable = ${isConsumerDelegable}, mode = ${mode}, personalData = ${personalData}, offset = ${offset}, limit = ${limit}`
      );
      const requesterId = authData.organizationId;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers,
          queries,
        });

      const results = await enhanceCatalogEservices(
        eservicesResponse.results,
        tenantProcessClient,
        agreementProcessClient,
        headers,
        requesterId
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };
      return response;
    },
    getProducerEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDescriptor> => {
      logger.info(
        `Retrieving producer EService Descriptor for eserviceId = ${eserviceId}, descriptorId = ${descriptorId}`
      );
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      await assertRequesterCanActAsProducer(
        delegationProcessClient,
        headers,
        requesterId,
        eservice
      );

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      const descriptorAttributeIds = getAttributeIds(descriptor);

      const attributes = await getAllBulkAttributes(
        attributeProcessClient,
        headers,
        descriptorAttributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor.attributes
      );

      const producerTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eservice.producerId,
        },
      });

      const eServiceTemplateId = eservice.templateId;

      const eserviceTemplate = eServiceTemplateId
        ? await eserviceTemplateProcessClient.getEServiceTemplateById({
            headers,
            params: {
              templateId: eServiceTemplateId,
            },
          })
        : undefined;

      const eserviceTemplateInterface = eserviceTemplate?.versions.find(
        (v) => v.id === descriptor.templateVersionRef?.id
      )?.interface;

      const delegation = (
        await delegationProcessClient.delegation.getDelegations({
          headers,
          queries: {
            kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
            delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
            eserviceIds: [eserviceId],
            offset: 0,
            limit: 1,
          },
        })
      ).results?.at(0);

      const delegate = delegation
        ? await tenantProcessClient.tenant.getTenant({
            headers,
            params: {
              id: delegation.delegateId,
            },
          })
        : undefined;

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        eservice: toBffCatalogApiProducerDescriptorEService(
          eservice,
          producerTenant
        ),
        publishedAt: descriptor.publishedAt,
        deprecatedAt: descriptor.deprecatedAt,
        archivedAt: descriptor.archivedAt,
        suspendedAt: descriptor.suspendedAt,
        rejectionReasons: descriptor.rejectionReasons,
        serverUrls: descriptor.serverUrls,
        templateRef: eserviceTemplate && {
          templateId: eserviceTemplate.id,
          templateName: eserviceTemplate.name,
          templateVersionId: descriptor.templateVersionRef?.id,
          templateInterface: eserviceTemplateInterface
            ? toBffCatalogApiDescriptorDoc(eserviceTemplateInterface)
            : undefined,
          interfaceMetadata: descriptor.templateVersionRef?.interfaceMetadata,
          isNewTemplateVersionAvailable:
            getLatestActiveDescriptor(eservice)?.id === descriptor.id &&
            checkNewTemplateVersionAvailable(eserviceTemplate, descriptor),
        },
        delegation:
          delegation !== undefined && delegate !== undefined
            ? {
                id: delegation.id,
                delegate: {
                  id: delegate.id,
                  name: delegate.name,
                  kind: delegate.kind,
                  contactMail: getLatestTenantContactEmail(delegate),
                },
                delegator: {
                  id: producerTenant.id,
                  name: producerTenant.name,
                  kind: producerTenant.kind,
                  contactMail: getLatestTenantContactEmail(producerTenant),
                },
              }
            : undefined,
      };
    },
    getProducerEServiceDetails: async (
      eServiceId: EServiceId,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDetails> => {
      logger.info(
        `Retrieving producer EService Details for eserviceId = ${eServiceId}`
      );
      const requesterId = authData.organizationId;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      await assertRequesterCanActAsProducer(
        delegationProcessClient,
        headers,
        requesterId,
        eservice
      );

      return {
        id: eservice.id,
        name: eservice.name,
        description: eservice.description,
        technology: eservice.technology,
        mode: eservice.mode,
        riskAnalysis: eservice.riskAnalysis.map(
          toBffCatalogApiEserviceRiskAnalysis
        ),
        isSignalHubEnabled: eservice.isSignalHubEnabled,
        isConsumerDelegable: eservice.isConsumerDelegable,
        isClientAccessDelegable: eservice.isClientAccessDelegable,
      };
    },
    updateEServiceDescription: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionUpdateSeed
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating EService Description for eserviceId = ${eServiceId}`
      );
      const updatedEservice =
        await catalogProcessClient.updateEServiceDescription(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
    },
    updateEServiceFlags: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDelegationFlagsUpdateSeed
    ): Promise<bffApi.CreatedResource> => {
      logger.info(`Updating EService Flags for eserviceId = ${eServiceId}`);
      const updatedEservice =
        await catalogProcessClient.updateEServiceDelegationFlags(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
    },
    updateEServiceName: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      nameUpdateSeed: bffApi.EServiceNameUpdateSeed
    ): Promise<void> => {
      logger.info(`Updating EService name of eservice with id = ${eServiceId}`);
      await catalogProcessClient.updateEServiceName(nameUpdateSeed, {
        headers,
        params: {
          eServiceId,
        },
      });
    },

    updateEServiceSignalHubFlag: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      signalhubActivateSeed: bffApi.EServiceSignalHubUpdateSeed
    ): Promise<void> => {
      logger.info(
        `Update signalhub flag for E-Service with id = ${eServiceId} to ${signalhubActivateSeed.isSignalHubEnabled}`
      );
      await catalogProcessClient.updateEServiceSignalHubFlag(
        signalhubActivateSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
    },

    updateEServicePersonalDataFlag: async (
      { headers, logger }: WithLogger<BffAppContext>,
      eServiceId: EServiceId,
      personalDataSeed: bffApi.EServicePersonalDataFlagUpdateSeed
    ): Promise<void> => {
      logger.info(
        `Set personal flag for E-Service with id = ${eServiceId} to ${personalDataSeed.personalData}`
      );
      await catalogProcessClient.updateEServicePersonalDataFlagAfterPublication(
        personalDataSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
    },

    createEService: async (
      eServiceSeed: bffApi.EServiceSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      logger.info(
        `Creating EService with seed ${JSON.stringify(eServiceSeed)}`
      );
      const { id, descriptors } = await catalogProcessClient.createEService(
        toCatalogCreateEServiceSeed(eServiceSeed),
        {
          headers,
        }
      );
      return { id, descriptorId: descriptors[0].id };
    },
    updateEServiceById: async (
      eServiceId: EServiceId,
      updateEServiceSeed: bffApi.UpdateEServiceSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating EService ${eServiceId} with seed ${JSON.stringify(
          updateEServiceSeed
        )}`
      );
      const { id } = await catalogProcessClient.updateDraftEServiceById(
        updateEServiceSeed,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id };
    },
    updateEServiceTemplateInstanceById: async (
      eServiceId: EServiceId,
      updateEServiceSeed: bffApi.UpdateEServiceTemplateInstanceSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating EService ${eServiceId} template instance with seed ${JSON.stringify(
          updateEServiceSeed
        )}`
      );
      const { id } =
        await catalogProcessClient.updateEServiceTemplateInstanceById(
          updateEServiceSeed,
          {
            headers,
            params: {
              eServiceId,
            },
          }
        );
      return { id };
    },
    deleteEService: async (
      eServiceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Deleting EService ${eServiceId}`);
      await catalogProcessClient.deleteEService(undefined, {
        headers,
        params: {
          eServiceId,
        },
      });
    },
    createEServiceDocument: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      doc: bffApi.createEServiceDocument_Body,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      ctx.logger.info(
        `Creating EService Document for EService ${eServiceId} and Descriptor ${descriptorId}`
      );
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers: ctx.headers,
      });

      retrieveEserviceDescriptor(eService, unsafeBrandId(descriptorId));

      const documentId = randomUUID();

      await verifyAndCreateDocument(
        fileManager,
        { id: eService.id, isEserviceTemplate: false },
        apiTechnologyToTechnology(eService.technology),
        doc.kind,
        doc.doc,
        documentId,
        config.eserviceDocumentsContainer,
        config.eserviceDocumentsPath,
        doc.prettyName,
        async (
          documentId,
          fileName,
          filePath,
          prettyName,
          kind,
          serverUrls,
          contentType,
          checksum
        ) => {
          await catalogProcessClient.createEServiceDocument(
            {
              documentId,
              prettyName,
              fileName,
              filePath,
              kind,
              contentType,
              checksum,
              serverUrls,
            },
            {
              headers: ctx.headers,
              params: {
                eServiceId: eService.id,
                descriptorId,
              },
            }
          );
        },
        ctx.logger
      );

      return { id: documentId };
    },
    getProducerEServices: async (
      eserviceName: string | undefined,
      consumersIds: string[],
      delegated: boolean | undefined,
      personalData: boolean | undefined,
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServices> => {
      logger.info(
        `Retrieving producer EServices with name ${eserviceName}, offset ${offset}, limit ${limit}, consumersIds ${JSON.stringify(
          consumersIds
        )}`
      );
      const requesterId = authData.organizationId;
      const res: {
        results: catalogApi.EService[];
        totalCount: number;
      } = {
        results: [],
        totalCount: 0,
      };

      if (consumersIds.length === 0) {
        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              producersIds: requesterId,
              delegated,
              personalData,
              offset,
              limit,
            },
          }
        );

        res.results = results;
        res.totalCount = totalCount;
      } else {
        const eserviceIds = (
          await getAllAgreements(agreementProcessClient, headers, {
            consumersIds,
            producersIds: [requesterId],
            eservicesIds: [],
            states: [],
          })
        ).map((agreement) => agreement.eserviceId);

        const { results, totalCount } = await catalogProcessClient.getEServices(
          {
            headers,
            queries: {
              name: eserviceName,
              eservicesIds: eserviceIds,
              producersIds: requesterId,
              delegated,
              offset,
              limit,
            },
          }
        );

        res.results = results;
        res.totalCount = totalCount;
      }

      const delegations = await getAllDelegations(
        delegationProcessClient,
        headers,
        {
          delegateIds: [],
          delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
          kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
          eserviceIds: res.results.map((r) => r.id),
        }
      );
      const delegationTenants = await getTenantsFromDelegation(
        tenantProcessClient,
        delegations,
        headers
      );

      const eserviceTemplatesIds = Array.from(
        new Set(
          res.results
            .map((r) => r.templateId)
            .filter((id): id is string => !!id)
        )
      );

      const eserviceTemplates = await getAllFromPaginated(
        async (offset, limit) =>
          await eserviceTemplateProcessClient.getEServiceTemplates({
            headers,
            queries: {
              eserviceTemplatesIds,
              offset,
              limit,
            },
          })
      );

      return {
        results: res.results.map((result) =>
          enhanceProducerEService(
            result,
            requesterId,
            delegations,
            delegationTenants,
            eserviceTemplates
          )
        ),
        pagination: {
          offset,
          limit,
          totalCount: res.totalCount,
        },
      };
    },
    getCatalogEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CatalogEServiceDescriptor> => {
      logger.info(
        `Retrieving Descriptor ${descriptorId} of EService ${eserviceId}`
      );
      const requesterId = authData.organizationId;

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);
      const attributeIds = getAttributeIds(descriptor);
      const attributes = await getAllBulkAttributes(
        attributeProcessClient,
        headers,
        attributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor.attributes
      );

      const requesterTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });

      const delegationTenantsSet = await getTenantsFromDelegation(
        tenantProcessClient,
        await getAllDelegations(delegationProcessClient, headers, {
          delegateIds: [requesterId],
          delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
          kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
          eserviceIds: [eserviceId],
        }),
        headers
      );

      const delegationTenants = Array.from(delegationTenantsSet.values());
      const consumerDelegators = delegationTenants.filter(
        (t) => t.id !== requesterId
      );

      const producerTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: eservice.producerId,
        },
      });
      const agreement = await getLatestAgreement(
        agreementProcessClient,
        requesterId,
        eservice,
        headers
      );

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        publishedAt: descriptor.publishedAt,
        suspendedAt: descriptor.suspendedAt,
        deprecatedAt: descriptor.deprecatedAt,
        archivedAt: descriptor.archivedAt,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        eservice: toBffCatalogDescriptorEService(
          eservice,
          descriptor,
          producerTenant,
          agreement,
          requesterTenant,
          consumerDelegators
        ),
      };
    },
    getEServiceConsumers: async (
      eserviceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<{
      filename: string;
      file: Buffer;
    }> => {
      logger.info(`Retrieving Consumers of EService ${eserviceId}`);
      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      const consumers = await getAllEserviceConsumers(
        catalogProcessClient,
        headers,
        eserviceId
      );

      const currentDate = formatDateyyyyMMddThhmmss(new Date());
      const filename = `${currentDate}-lista-fruitori-${eservice.name}.csv`;

      const buildCsv = (consumers: catalogApi.EServiceConsumer[]): string =>
        [
          "versione,stato_versione,stato_richiesta_fruizione,fruitore,codice_ipa_fruitore",
          ...consumers.map((c) =>
            [
              c.descriptorVersion,
              c.descriptorState,
              c.agreementState,
              c.consumerName,
              c.consumerExternalId,
            ].join(",")
          ),
        ].join("\n");

      return {
        filename,
        file: Buffer.from(buildCsv(consumers)),
      };
    },
    updateEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      riskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating risk analysis ${riskAnalysisId} of EService ${eserviceId}`
      );
      await catalogProcessClient.updateRiskAnalysis(riskAnalysisSeed, {
        headers,
        params: {
          eServiceId: eserviceId,
          riskAnalysisId,
        },
      });
    },
    deleteEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting risk analysis ${riskAnalysisId} of EService ${eserviceId}`
      );
      await catalogProcessClient.deleteRiskAnalysis(undefined, {
        headers,
        params: {
          eServiceId: eserviceId,
          riskAnalysisId,
        },
      });
    },
    addRiskAnalysisToEService: async (
      eserviceId: EServiceId,
      riskAnalysisSeed: bffApi.EServiceRiskAnalysisSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Adding risk analysis to EService ${eserviceId}`);
      await catalogProcessClient.createRiskAnalysis(
        {
          name: riskAnalysisSeed.name,
          riskAnalysisForm: riskAnalysisSeed.riskAnalysisForm,
        },
        {
          headers,
          params: {
            eServiceId: eserviceId,
          },
        }
      );
    },
    getEServiceRiskAnalysis: async (
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceRiskAnalysis> => {
      logger.info(
        `Retrieving risk analysis ${riskAnalysisId} of EService ${eserviceId}`
      );
      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      const riskAnalysis = retrieveRiskAnalysis(eservice, riskAnalysisId);

      return toBffCatalogApiEserviceRiskAnalysis(riskAnalysis);
    },
    getEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ contentType: string; document: Buffer }> => {
      logger.info(
        `Retrieving document ${documentId} of descriptor ${descriptorId} of EService ${eServiceId}`
      );
      const { path, contentType } =
        await catalogProcessClient.getEServiceDocumentById({
          params: {
            eServiceId,
            descriptorId,
            documentId,
          },
          headers,
        });

      const stream = await fileManager.get(
        config.eserviceDocumentsContainer,
        path,
        logger
      );

      return { contentType, document: Buffer.from(stream) };
    },
    createDescriptor: async (
      eServiceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(`Creating descriptor for EService ${eServiceId}`);
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers,
      });

      if (eService.descriptors.length === 0) {
        throw noDescriptorInEservice(eServiceId);
      }

      const retrieveLatestDescriptor = (
        descriptors: catalogApi.EServiceDescriptor[]
      ): catalogApi.EServiceDescriptor =>
        descriptors.reduce(
          (latestDescriptor, curr) =>
            parseInt(curr.version, 10) > parseInt(latestDescriptor.version, 10)
              ? curr
              : latestDescriptor,
          descriptors[0]
        );

      const previousDescriptor = retrieveLatestDescriptor(eService.descriptors);

      if (eService.templateId) {
        const { id } =
          await catalogProcessClient.createTemplateInstanceDescriptor(
            {
              audience: [],
              dailyCallsPerConsumer: previousDescriptor.dailyCallsPerConsumer,
              dailyCallsTotal: previousDescriptor.dailyCallsTotal,
              agreementApprovalPolicy:
                previousDescriptor.agreementApprovalPolicy,
            },
            {
              headers,
              params: {
                eServiceId,
              },
            }
          );
        return { id };
      }

      const clonedDocumentsCalls = previousDescriptor.docs.map((doc) =>
        cloneEServiceDocument({
          doc,
          documentsContainer: config.eserviceDocumentsContainer,
          documentsPath: config.eserviceDocumentsPath,
          fileManager,
          logger,
        })
      );

      const clonedDocuments = await Promise.all(clonedDocumentsCalls);

      const response = await catalogProcessClient.createDescriptor(
        {
          description: previousDescriptor.description,
          audience: [],
          voucherLifespan: previousDescriptor.voucherLifespan,
          dailyCallsPerConsumer: previousDescriptor.dailyCallsPerConsumer,
          dailyCallsTotal: previousDescriptor.dailyCallsTotal,
          agreementApprovalPolicy: previousDescriptor.agreementApprovalPolicy,
          attributes: previousDescriptor.attributes,
          docs: clonedDocuments,
        },
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );
      return { id: response.createdDescriptorId };
    },
    deleteDraft: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting draft descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.deleteDraft(undefined, {
        headers,
        params: {
          descriptorId,
          eServiceId,
        },
      });
    },
    updateDraftDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      updateEServiceDescriptorSeed: bffApi.UpdateEServiceDescriptorSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating draft descriptor ${descriptorId} of EService ${eServiceId}`
      );
      const { id } = await catalogProcessClient.updateDraftDescriptor(
        updateEServiceDescriptorSeed,
        {
          headers,
          params: {
            descriptorId,
            eServiceId,
          },
        }
      );
      return { id };
    },
    updateDraftDescriptorTemplateInstance: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      updateEServiceDescriptorSeed: bffApi.UpdateEServiceDescriptorTemplateInstanceSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating draft descriptor ${descriptorId} of EService ${eServiceId} template instance`
      );
      const { id } =
        await catalogProcessClient.updateDraftDescriptorTemplateInstance(
          updateEServiceDescriptorSeed,
          {
            headers,
            params: {
              descriptorId,
              eServiceId,
            },
          }
        );
      return { id };
    },
    deleteEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Deleting document ${documentId} of descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.deleteEServiceDocumentById(undefined, {
        params: {
          eServiceId,
          descriptorId,
          documentId,
        },
        headers,
      });
    },
    cloneEServiceByDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      logger.info(
        `Cloning EService ${eServiceId} by descriptor ${descriptorId}`
      );
      const eService = await catalogProcessClient.cloneEServiceByDescriptor(
        undefined,
        {
          params: {
            eServiceId,
            descriptorId,
          },
          headers,
        }
      );
      const eServiceDescriptorId = eService.descriptors.at(0)?.id;
      if (!eServiceDescriptorId) {
        throw missingDescriptorInClonedEservice(eService.id);
      }
      return { id: eService.id, descriptorId: eServiceDescriptorId };
    },
    activateDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Activating descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.activateDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorQuotasSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating descriptor ${descriptorId} of EService ${eServiceId}`
      );
      return await catalogProcessClient.updateDescriptor(seed, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateAgreementApprovalPolicy: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceDescriptorAgreementApprovalPolicySeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating descriptor ${descriptorId} agreementApprovalPolicy of EService ${eServiceId}`
      );

      return await catalogProcessClient.updateAgreementApprovalPolicy(seed, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    publishDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Publishing descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.publishDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    suspendDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Suspending descriptor ${descriptorId} of EService ${eServiceId}`
      );
      await catalogProcessClient.suspendDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateEServiceDocumentById: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      updateEServiceDescriptorDocumentSeed: bffApi.UpdateEServiceDescriptorDocumentSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<catalogApi.EServiceDoc> => {
      logger.info(
        `Updating document ${documentId} of descriptor ${descriptorId} of EService ${eServiceId}`
      );
      return await catalogProcessClient.updateEServiceDocumentById(
        updateEServiceDescriptorDocumentSeed,
        {
          params: {
            eServiceId,
            descriptorId,
            documentId,
          },
          headers,
        }
      );
    },
    exportEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { authData, headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.FileResource> => {
      logger.info(
        `Exporting descriptor ${descriptorId} of EService ${eserviceId}`
      );
      const requesterId = authData.organizationId;

      const eservice = await catalogProcessClient.getEServiceById({
        params: {
          eServiceId: eserviceId,
        },
        headers,
      });

      assertEServiceNotTemplateInstance(eservice);

      assertRequesterIsProducer(requesterId, eservice);
      await assertNotDelegatedEservice(
        delegationProcessClient,
        headers,
        requesterId,
        eserviceId
      );

      const zipFolderName = `${eservice.id}_${descriptorId}`;
      const zipFile = await createDescriptorDocumentZipFile(
        bffConfig.eserviceDocumentsContainer,
        fileManager,
        logger,
        zipFolderName,
        eservice,
        descriptorId
      );

      const zipFilePath = `${bffConfig.exportEservicePath}/${requesterId}`;
      const zipFileName = `${zipFolderName}.zip`;
      await fileManager.storeBytes(
        {
          bucket: bffConfig.exportEserviceContainer,
          path: zipFilePath,
          name: zipFileName,
          content: Buffer.from(zipFile),
        },
        logger
      );

      const url = await fileManager.generateGetPresignedUrl(
        bffConfig.exportEserviceContainer,
        zipFilePath,
        zipFileName,
        bffConfig.presignedUrlGetDurationMinutes
      );

      return {
        filename: zipFileName,
        url,
      };
    },
    generatePutPresignedUrl: async (
      filename: string,
      { authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PresignedUrl> => {
      logger.info(
        `Generating presigned url for file ${filename} for organization ${authData.organizationId}`
      );
      const path = `${bffConfig.importEservicePath}/${authData.organizationId}`;
      const url = await fileManager.generatePutPresignedUrl(
        bffConfig.importEserviceContainer,
        path,
        filename,
        bffConfig.presignedUrlPutDurationMinutes
      );

      return {
        url,
      };
    },
    importEService: async (
      fileResource: bffApi.FileResource,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      const { logger, authData, headers } = context;
      logger.info(
        `Importing EService for organization ${authData.organizationId}`
      );
      const tenantId = authData.organizationId;
      const zipFile = await fileManager.get(
        config.importEserviceContainer,
        `${config.importEservicePath}/${tenantId}/${fileResource.filename}`,
        logger
      );

      const zip = new AdmZip(Buffer.from(zipFile));

      const rootFolderName = fileResource.filename.replace(".zip", "");

      const entriesMap = zip.getEntries().reduce((map, entry) => {
        map.set(entry.entryName.replace(rootFolderName + "/", ""), entry);
        return map;
      }, new Map<string, AdmZip.IZipEntry>());
      entriesMap.delete("");

      const configurationEntry = entriesMap.get("configuration.json");
      if (!configurationEntry) {
        throw invalidZipStructure("Error reading configuration.json");
      }

      const jsonContent = configurationEntry.getData().toString("utf8");
      const { data: importedEservice, error } = ConfigurationEservice.safeParse(
        JSON.parse(jsonContent)
      );

      if (error) {
        throw invalidZipStructure("Error decoding configuration.json");
      }
      const docsPath = importedEservice.descriptor.docs.map((doc) =>
        entriesMap.get(doc.path)?.getData()
      );
      if (docsPath.some((doc) => doc === undefined)) {
        throw invalidZipStructure("Error reading docs");
      }

      const descriptorInterface = importedEservice.descriptor.interface;

      if (
        descriptorInterface &&
        entriesMap.get(descriptorInterface.path) === undefined
      ) {
        throw invalidZipStructure("Error reading interface");
      }

      const allowedFiles = [
        "configuration.json",
        "documents/",
        importedEservice.descriptor.interface?.path,
        ...importedEservice.descriptor.docs.map((doc) => doc.path),
      ].filter(
        (path: string | undefined): path is string => path !== undefined
      );

      const filePaths = Array.from(entriesMap.keys());

      const difference = filePaths.filter(
        (item) => !allowedFiles.includes(item)
      );
      if (difference.length > 0) {
        throw invalidZipStructure(
          `Not allowed files found: ${difference.join(", ")}`
        );
      }

      const eserviceSeed: catalogApi.EServiceSeed = {
        name: importedEservice.name,
        description: importedEservice.description,
        technology: importedEservice.technology,
        mode: importedEservice.mode,
        descriptor: {
          description: importedEservice.descriptor.description,
          audience: importedEservice.descriptor.audience,
          voucherLifespan: importedEservice.descriptor.voucherLifespan,
          dailyCallsPerConsumer:
            importedEservice.descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: importedEservice.descriptor.dailyCallsTotal,
          agreementApprovalPolicy:
            importedEservice.descriptor.agreementApprovalPolicy,
        },
        isSignalHubEnabled: importedEservice.isSignalHubEnabled,
        isConsumerDelegable: importedEservice.isConsumerDelegable,
        isClientAccessDelegable: importedEservice.isClientAccessDelegable,
      };

      const pollEServiceById = createPollingByCondition(() =>
        catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eservice.id,
          },
          headers,
        })
      );

      const eservice = await catalogProcessClient.createEService(eserviceSeed, {
        headers,
      });
      await pollEServiceById({
        condition: (result) => result.descriptors.length > 0,
      });

      for (const riskAnalysis of importedEservice.riskAnalysis) {
        try {
          await catalogProcessClient.createRiskAnalysis(
            toBffCatalogApiEserviceRiskAnalysisSeed(riskAnalysis),
            {
              headers,
              params: {
                eServiceId: eservice.id,
              },
            }
          );
        } catch (error) {
          await catalogProcessClient.deleteEService(undefined, {
            headers: context.headers,
            params: {
              eServiceId: eservice.id,
            },
          });
        }
        await pollEServiceById({
          condition: (result) => result.riskAnalysis.length > 0,
        });
      }

      const createEserviceDocumentRequest = async (
        documentId: string,
        fileName: string,
        filePath: string,
        prettyName: string,
        kind: "INTERFACE" | "DOCUMENT",
        serverUrls: string[],
        contentType: string,
        checksum: string
      ) =>
        await catalogProcessClient.createEServiceDocument(
          {
            documentId,
            prettyName,
            fileName,
            filePath,
            kind,
            contentType,
            checksum,
            serverUrls,
          },
          {
            headers: context.headers,
            params: {
              eServiceId: eservice.id,
              descriptorId: descriptor.id,
            },
          }
        );

      const descriptor = eservice.descriptors[0];
      if (descriptorInterface) {
        await verifyAndCreateImportedDocument(
          fileManager,
          unsafeBrandId(eservice.id),
          apiTechnologyToTechnology(eservice.technology),
          entriesMap,
          descriptorInterface,
          "INTERFACE",
          createEserviceDocumentRequest,
          config.eserviceDocumentsContainer,
          config.eserviceDocumentsPath,
          context.logger
        );
      }
      await pollEServiceById({
        condition: (result) =>
          result.descriptors.some(
            (d) => d.id === descriptor.id && d.interface !== undefined
          ),
      });

      for (const doc of importedEservice.descriptor.docs) {
        await verifyAndCreateImportedDocument(
          fileManager,
          unsafeBrandId(eservice.id),
          apiTechnologyToTechnology(eservice.technology),
          entriesMap,
          doc,
          "DOCUMENT",
          createEserviceDocumentRequest,
          config.eserviceDocumentsContainer,
          config.eserviceDocumentsPath,
          context.logger
        );
        await pollEServiceById({
          condition: (result) =>
            result.descriptors.some(
              (d) =>
                d.id === descriptor.id &&
                d.docs.some((d) => d.prettyName === doc.prettyName)
            ),
        });
      }

      return {
        id: eservice.id,
        descriptorId: eservice.descriptors[0].id,
      };
    },
    approveDelegatedEServiceDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Approving e-service ${eServiceId} version ${descriptorId}`);
      await catalogProcessClient.approveDelegatedEServiceDescriptor(undefined, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    rejectDelegatedEServiceDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: EServiceId,
      body: catalogApi.RejectDelegatedEServiceDescriptorSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(`Rejecting e-service ${eServiceId} version ${descriptorId}`);
      await catalogProcessClient.rejectDelegatedEServiceDescriptor(body, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    updateDescriptorAttributes: async (
      eServiceId: EServiceId,
      descriptorId: EServiceId,
      body: bffApi.DescriptorAttributesSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> => {
      logger.info(
        `Updating attributes of Descriptor ${descriptorId} for EService ${eServiceId}`
      );
      await catalogProcessClient.updateDescriptorAttributes(body, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
    upgradeEServiceInstance: async (
      eServiceId: EServiceId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Upgrading EService ${eServiceId} to latest template version `
      );
      const { id } = await catalogProcessClient.upgradeEServiceInstance(
        undefined,
        {
          headers,
          params: {
            eServiceId,
          },
        }
      );

      return { id };
    },
    createEServiceInstanceFromTemplate: async (
      templateId: EServiceTemplateId,
      seed: bffApi.InstanceEServiceSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedEServiceDescriptor> => {
      logger.info(`Creating EService from template ${templateId}`);

      const eService =
        await catalogProcessClient.createEServiceInstanceFromTemplate(seed, {
          headers,
          params: {
            templateId,
          },
        });

      return {
        id: eService.id,
        descriptorId: eService.descriptors[0].id,
      };
    },
    getEServiceTemplateInstances: async (
      eServiceTemplateId: EServiceTemplateId,
      producerName: string | undefined,
      states: bffApi.EServiceDescriptorState[],
      offset: number,
      limit: number,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EServiceTemplateInstances> => {
      logger.info(
        `Retrieving EService template ${eServiceTemplateId} instances with state=${states} producerName=${producerName} offset=${offset} limit=${limit}`
      );

      // This assures that the template exists
      await retrieveEServiceTemplate(
        eServiceTemplateId,
        eserviceTemplateProcessClient,
        headers
      );

      const tenants = producerName
        ? await getAllFromPaginated((offset, limit) =>
            tenantProcessClient.tenant.getTenants({
              queries: {
                name: producerName,
                offset,
                limit,
              },
              headers,
            })
          )
        : [];

      const tenantsMap = new Map(tenants.map((t) => [t.id, t]));
      const tentantsIds = Array.from(tenantsMap.keys());

      const defaultStates: catalogApi.EServiceDescriptorState[] = [
        catalogApi.EServiceDescriptorState.Values.PUBLISHED,
        catalogApi.EServiceDescriptorState.Values.SUSPENDED,
        catalogApi.EServiceDescriptorState.Values.ARCHIVED,
        catalogApi.EServiceDescriptorState.Values.DEPRECATED,
      ];

      const { results, totalCount } = await catalogProcessClient.getEServices({
        headers,
        queries: {
          producersIds: tentantsIds,
          templatesIds: [eServiceTemplateId],
          states: states.length === 0 ? defaultStates : states,
          offset,
          limit,
        },
      });

      const enhanceTemplateInstance = async (
        eservice: catalogApi.EService
      ): Promise<bffApi.EServiceTemplateInstance> => {
        const producer =
          tenantsMap.get(eservice.producerId) ??
          (await tenantProcessClient.tenant.getTenant({
            headers,
            params: {
              id: eservice.producerId,
            },
          }));

        tenantsMap.set(eservice.producerId, producer);

        return toBffEServiceTemplateInstance(eservice, producer);
      };

      return {
        results: await Promise.all(results.map(enhanceTemplateInstance)),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    addEServiceTemplateInstanceInterfaceRest: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      eserviceInstanceInterfaceData: bffApi.TemplateInstanceInterfaceRESTSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      await catalogProcessClient.addEServiceTemplateInstanceInterfaceRest(
        eserviceInstanceInterfaceData,
        {
          headers,
          params: {
            eServiceId,
            descriptorId,
          },
        }
      );

      return { id: descriptorId };
    },
    addEServiceTemplateInstanceInterfaceSoap: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      eserviceInstanceInterfaceData: bffApi.TemplateInstanceInterfaceSOAPSeed,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      await catalogProcessClient.addEServiceTemplateInstanceInterfaceSoap(
        eserviceInstanceInterfaceData,
        {
          headers,
          params: {
            eServiceId,
            descriptorId,
          },
        }
      );

      return { id: descriptorId };
    },
    async isEServiceNameAvailable(
      name: string,
      { headers, logger, authData }: WithLogger<BffAppContext>
    ): Promise<boolean> {
      logger.info(
        `Checking e-service name availability ${name} for producer ${authData.organizationId}`
      );

      const eservices = await getAllFromPaginated((offset, limit) =>
        catalogProcessClient.getEServices({
          headers,
          queries: {
            limit,
            offset,
            producersIds: [authData.organizationId],
            name,
          },
        })
      );

      const eserviceTemplates = await getAllFromPaginated((offset, limit) =>
        eserviceTemplateProcessClient.getEServiceTemplates({
          headers,
          queries: {
            limit,
            offset,
            name,
          },
        })
      );

      return ![...eserviceTemplates, ...eservices].some(
        (e) => e.name.toLowerCase() === name.toLowerCase()
      );
    },
    updateTemplateInstanceDescriptor: async (
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      seed: catalogApi.UpdateEServiceTemplateInstanceDescriptorQuotasSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> => {
      logger.info(
        `Updating template instance descriptor ${descriptorId} of EService ${eServiceId}`
      );
      return await catalogProcessClient.updateTemplateInstanceDescriptor(seed, {
        headers,
        params: {
          eServiceId,
          descriptorId,
        },
      });
    },
  };
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
