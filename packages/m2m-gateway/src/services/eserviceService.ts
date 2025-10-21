import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  attributeRegistryApi,
  catalogApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  ListResult,
  RiskAnalysisId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetEServicesQueryParams,
  toM2MGatewayApiEService,
  toM2MGatewayApiEServiceDescriptor,
  toCatalogApiEServiceDescriptorSeed,
  toM2MGatewayApiEServiceRiskAnalysis,
  toCatalogApiPatchUpdateEServiceDescriptorSeed,
  toM2MGatewayApiDocument,
} from "../api/eserviceApiConverter.js";
import {
  cannotDeleteLastEServiceDescriptor,
  eserviceDescriptorAttributeNotFound,
  eserviceDescriptorInterfaceNotFound,
  eserviceDescriptorNotFound,
  eserviceRiskAnalysisNotFound,
} from "../model/errors.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { config } from "../config/config.js";
import { DownloadedDocument, downloadDocument } from "../utils/fileDownload.js";
import { uploadEServiceDocument } from "../utils/fileUpload.js";
import {
  pollResourceWithMetadata,
  isPolledVersionAtLeastMetadataTargetVersion,
  isPolledVersionAtLeastResponseVersion,
  pollResourceUntilDeletion,
} from "../utils/polling.js";
import {
  toM2MGatewayApiCertifiedAttribute,
  toM2MGatewayApiDeclaredAttribute,
  toM2MGatewayApiVerifiedAttribute,
} from "../api/attributeApiConverter.js";
import { EServiceDescriptorAttributesGroupSeed } from "../../../api-clients/dist/m2mGatewayApi.js";

export type EserviceService = ReturnType<typeof eserviceServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
) {
  const retrieveEServiceById = async (
    headers: M2MGatewayAppContext["headers"],
    eserviceId: EServiceId
  ): Promise<WithMaybeMetadata<catalogApi.EService>> =>
    await clients.catalogProcessClient.getEServiceById({
      params: {
        eServiceId: eserviceId,
      },
      headers,
    });

  const retrieveEServiceDescriptorById = (
    eservice: WithMaybeMetadata<catalogApi.EService>,
    descriptorId: DescriptorId
  ): catalogApi.EServiceDescriptor => {
    const descriptor = eservice.data.descriptors.find(
      (e) => e.id === descriptorId
    );

    if (!descriptor) {
      throw eserviceDescriptorNotFound(eservice.data.id, descriptorId);
    }

    return descriptor;
  };

  const retrieveEServiceRiskAnalysisById = (
    eservice: WithMaybeMetadata<catalogApi.EService>,
    riskAnalysisId: RiskAnalysisId
  ): catalogApi.EServiceRiskAnalysis => {
    const riskAnalysis = eservice.data.riskAnalysis.find(
      (r) => r.id === riskAnalysisId
    );

    if (!riskAnalysis) {
      throw eserviceRiskAnalysisNotFound(eservice.data.id, riskAnalysisId);
    }

    return riskAnalysis;
  };

  // eslint-disable-next-line max-params
  async function retrieveEServiceDescriptorAttributes(
    eservice: WithMaybeMetadata<catalogApi.EService>,
    descriptorId: DescriptorId,
    attributeKind: keyof catalogApi.Attributes,
    { offset, limit }: { offset: number; limit: number },
    headers: M2MGatewayAppContext["headers"]
  ): Promise<
    ListResult<{
      attribute: attributeRegistryApi.Attribute;
      groupIndex: number;
    }>
  > {
    const descriptor = retrieveEServiceDescriptorById(eservice, descriptorId);
    const kindAttributeGroups = descriptor.attributes[attributeKind];
    const allFlatKindAttributes: Array<{
      attributeId: string;
      groupIndex: number;
    }> = kindAttributeGroups.flatMap((group, groupIndex) =>
      group.map((attribute) => ({
        attributeId: attribute.id,
        groupIndex,
      }))
    );

    const paginatedFlatKindAttributes = allFlatKindAttributes.slice(
      offset,
      offset + limit
    );

    const attributeIdsToResolve: Array<attributeRegistryApi.Attribute["id"]> =
      paginatedFlatKindAttributes.map((item) => item.attributeId);

    if (attributeIdsToResolve.length === 0) {
      return {
        results: [],
        totalCount: attributeIdsToResolve.length,
      };
    }

    // Resolve the complete details only for the attributes needed on the page.
    const bulkResult = await clients.attributeProcessClient.getBulkedAttributes(
      attributeIdsToResolve,
      {
        headers,
        queries: {
          offset,
          limit,
        },
      }
    );

    // Convert the result array into a Map for efficient lookup
    const attributeMap: Map<string, attributeRegistryApi.Attribute> = new Map(
      bulkResult.data.results.map((attr) => [attr.id, attr])
    );

    // Recombination: Map the paginated flat list with the resolved complete details
    const attributesToReturn = paginatedFlatKindAttributes.map((item) => {
      const attributeDetailed = attributeMap.get(item.attributeId);

      if (!attributeDetailed) {
        throw eserviceDescriptorAttributeNotFound(descriptorId);
      }

      return {
        attribute: attributeDetailed,
        groupIndex: item.groupIndex,
      };
    });

    return {
      results: attributesToReturn,
      totalCount: allFlatKindAttributes.length,
    };
  }
  async function createEServiceDescriptorAttributesGroup(
    eserviceId: EServiceId,
    descriptorId: DescriptorId,
    attributeIds: EServiceDescriptorAttributesGroupSeed,
    attributeKind: keyof catalogApi.Attributes,
    { headers }: WithLogger<M2MGatewayAppContext>
  ): Promise<{
    groupIndex: number;
    attributes: attributeRegistryApi.Attributes;
  }> {

    const eservice = await retrieveEServiceById(headers, eserviceId);

    const descriptor = retrieveEServiceDescriptorById(eservice, descriptorId);

    const newGroupIndex = descriptor.attributes[attributeKind].length;

    const newAttributeGroups = [
      ...descriptor.attributes[attributeKind],
      attributeIds.attributeIds.map((id) => ({
        id,
        explicitAttributeVerification: false,
      })),
    ];

    const newAttributes = {
      ...descriptor.attributes,
      [attributeKind]: newAttributeGroups,
    };

    const response = await clients.catalogProcessClient.patchUpdateDraftDescriptor(
      { attributes: newAttributes },
      {
        params: { eServiceId: eserviceId, descriptorId },
        headers,
      }
    );

    const updatedEservice = await pollEService(response, headers);

    const allAttributesWithDetails = await retrieveEServiceDescriptorAttributes(
      updatedEservice,
      descriptorId,
      attributeKind,
      { offset: 0, limit: Infinity },
      headers
    );

    const newlyCreatedGroupAttributes =
      allAttributesWithDetails.results.filter(
        (item) => item.groupIndex === newGroupIndex
      );

    const attributesToReturn: attributeRegistryApi.Attributes = {
      results: newlyCreatedGroupAttributes.map((item) => item.attribute),
      totalCount: newlyCreatedGroupAttributes.length,
    };

    return {
      groupIndex: newGroupIndex,
      attributes: attributesToReturn,
    };
  }
  const pollEserviceUntilDeletion = (
    eserviceId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrieveEServiceById(headers, unsafeBrandId(eserviceId))
    )({});

  const pollEServiceById = (
    eserviceId: EServiceId,
    metadata: { version: number } | undefined,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<catalogApi.EService>> =>
    pollResourceWithMetadata(() => retrieveEServiceById(headers, eserviceId))({
      condition: isPolledVersionAtLeastMetadataTargetVersion(metadata),
    });

  const pollEService = (
    response: WithMaybeMetadata<catalogApi.EService>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<catalogApi.EService>> =>
    pollResourceWithMetadata(() =>
      retrieveEServiceById(headers, unsafeBrandId(response.data.id))
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getEService(
      eserviceId: EServiceId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(`Retrieving eservice with id ${eserviceId}`);
      const response = await retrieveEServiceById(headers, eserviceId);
      return toM2MGatewayApiEService(response.data);
    },
    async getEServices(
      params: m2mGatewayApi.GetEServicesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServices> {
      logger.info(
        `Retrieving eservices with producerIds ${params.producerIds} templateIds ${params.templateIds} offset ${params.offset} limit ${params.limit}`
      );

      const {
        data: { results, totalCount },
      } = await clients.catalogProcessClient.getEServices({
        queries: toGetEServicesQueryParams(params),
        headers,
      });

      return {
        results: results.map(toM2MGatewayApiEService),
        pagination: {
          limit: params.limit,
          offset: params.offset,
          totalCount,
        },
      };
    },
    async getEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Retrieving eservice descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const descriptor = retrieveEServiceDescriptorById(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId
      );

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },
    async getEServiceDescriptors(
      eserviceId: EServiceId,
      { state, offset, limit }: m2mGatewayApi.GetEServiceDescriptorsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptors> {
      logger.info(
        `Retrieving eservice descriptors for eservice with id ${eserviceId} states ${state} offset ${offset} limit ${limit}`
      );

      const {
        data: { descriptors },
      } = await clients.catalogProcessClient.getEServiceById({
        params: { eServiceId: eserviceId },
        headers,
      });

      const filteredDescriptors = state
        ? descriptors.filter((descriptor) => descriptor.state === state)
        : descriptors;

      const paginatedDescriptors = filteredDescriptors.slice(
        offset,
        offset + limit
      );

      return {
        pagination: {
          limit,
          offset,
          totalCount: filteredDescriptors.length,
        },
        results: paginatedDescriptors.map(toM2MGatewayApiEServiceDescriptor),
      };
    },
    async downloadEServiceDescriptorDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(
        `Retrieving document with id ${documentId} for eservice descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const { data: document } =
        await clients.catalogProcessClient.getEServiceDocumentById({
          params: {
            eServiceId: eserviceId,
            descriptorId,
            documentId,
          },
          headers,
        });

      return downloadDocument(
        document,
        fileManager,
        config.eserviceDocumentsContainer,
        logger
      );
    },
    async getEServiceDescriptorDocuments(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      {
        offset,
        limit,
      }: m2mGatewayApi.GetEServiceDescriptorDocumentsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Documents> {
      logger.info(
        `Retrieving documents for eservice descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const { data: documents } =
        await clients.catalogProcessClient.getEServiceDocuments({
          params: {
            eServiceId: eserviceId,
            descriptorId,
          },
          queries: {
            offset,
            limit,
          },
          headers,
        });

      return {
        results: documents.results.map(toM2MGatewayApiDocument),
        pagination: {
          limit,
          offset,
          totalCount: documents.totalCount,
        },
      };
    },
    async uploadEServiceDescriptorDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      fileUpload: m2mGatewayApi.FileUploadMultipart,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Document> {
      logger.info(
        `Adding document ${fileUpload.file.name} to descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const { data: eservice } = await retrieveEServiceById(
        headers,
        eserviceId
      );

      const { data: document, metadata } = await uploadEServiceDocument({
        eservice,
        descriptorId,
        documentKind: catalogApi.EServiceDocumentKind.Values.DOCUMENT,
        fileUpload,
        fileManager,
        catalogProcessClient: clients.catalogProcessClient,
        headers,
        logger,
      });

      await pollEServiceById(eserviceId, metadata, headers);

      return toM2MGatewayApiDocument(document);
    },
    async deleteEServiceDescriptorDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting document with id ${documentId} from eservice descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const response =
        await clients.catalogProcessClient.deleteEServiceDocumentById(
          undefined,
          {
            params: {
              eServiceId: eserviceId,
              descriptorId,
              documentId,
            },
            headers,
          }
        );

      await pollEService(response, headers);
    },
    async downloadEServiceDescriptorInterface(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(
        `Retrieving interface for eservice descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const descriptor = retrieveEServiceDescriptorById(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId
      );

      if (!descriptor.interface) {
        throw eserviceDescriptorInterfaceNotFound(eserviceId, descriptorId);
      }

      return downloadDocument(
        descriptor.interface,
        fileManager,
        config.eserviceDocumentsContainer,
        logger
      );
    },
    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: m2mGatewayApi.EServiceDescriptorSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const {
        data: { eservice, createdDescriptorId },
        metadata,
      } = await clients.catalogProcessClient.createDescriptor(
        toCatalogApiEServiceDescriptorSeed(eserviceDescriptorSeed),
        {
          params: { eServiceId: eserviceId },
          headers,
        }
      );

      await pollEService(
        {
          data: eservice,
          metadata,
        },
        headers
      );

      const createdDescriptor = retrieveEServiceDescriptorById(
        { data: eservice, metadata },
        unsafeBrandId(createdDescriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(createdDescriptor);
    },

    async updateDraftEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: m2mGatewayApi.EServiceDescriptorDraftUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Updating draft descriptor ${descriptorId} for eservice ${eserviceId}`
      );

      const response =
        await clients.catalogProcessClient.patchUpdateDraftDescriptor(
          toCatalogApiPatchUpdateEServiceDescriptorSeed(seed),
          {
            params: { eServiceId: eserviceId, descriptorId },
            headers,
          }
        );

      await pollEService(response, headers);

      const updatedDescriptor = retrieveEServiceDescriptorById(
        response,
        unsafeBrandId(descriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(updatedDescriptor);
    },

    async deleteDraftEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting descriptor ${descriptorId} for eservice with id ${eserviceId}`
      );

      const { data: eservice } = await retrieveEServiceById(
        headers,
        eserviceId
      );

      if (
        eservice.descriptors.length === 1 &&
        eservice.descriptors[0].id === descriptorId
      ) {
        throw cannotDeleteLastEServiceDescriptor(eserviceId, descriptorId);
      }

      const { metadata } = await clients.catalogProcessClient.deleteDraft(
        undefined,
        {
          params: { eServiceId: eserviceId, descriptorId },
          headers,
        }
      );
      await pollEServiceById(eserviceId, metadata, headers);
    },
    async createEService(
      seed: m2mGatewayApi.EServiceSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(`Creating EService with name ${seed.name}`);

      const response = await clients.catalogProcessClient.createEService(seed, {
        headers,
      });
      const polledResource = await pollEService(response, headers);
      return toM2MGatewayApiEService(polledResource.data);
    },

    async updateDraftEService(
      eserviceId: EServiceId,
      seed: m2mGatewayApi.EServiceDraftUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(`Updating draft EService with id ${eserviceId}`);

      const response =
        await clients.catalogProcessClient.patchUpdateDraftEServiceById(seed, {
          params: { eServiceId: eserviceId },
          headers,
        });
      const polledResource = await pollEService(response, headers);
      return toM2MGatewayApiEService(polledResource.data);
    },
    async deleteEService(
      eserviceId: EServiceId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting eservice with id ${eserviceId}`);

      await clients.catalogProcessClient.deleteEService(undefined, {
        params: { eServiceId: eserviceId },
        headers,
      });
      await pollEserviceUntilDeletion(eserviceId, headers);
    },

    async updatePublishedEServiceDelegation(
      eserviceId: EServiceId,
      seed: m2mGatewayApi.EServiceDelegationUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(
        `Updating delegation configurations for published E-Service with id ${eserviceId}`
      );

      const { data: eservice } = await retrieveEServiceById(
        headers,
        eserviceId
      );

      const response =
        await clients.catalogProcessClient.updateEServiceDelegationFlags(
          {
            isConsumerDelegable:
              seed.isConsumerDelegable ?? Boolean(eservice.isConsumerDelegable),
            isClientAccessDelegable:
              seed.isClientAccessDelegable ??
              Boolean(eservice.isClientAccessDelegable),
          },
          {
            params: { eServiceId: eserviceId },
            headers,
          }
        );

      const polledResource = await pollEService(response, headers);
      return toM2MGatewayApiEService(polledResource.data);
    },

    async updatePublishedEServiceDescription(
      eserviceId: EServiceId,
      seed: m2mGatewayApi.EServiceDescriptionUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(
        `Updating description for published E-Service with id ${eserviceId}`
      );

      const response =
        await clients.catalogProcessClient.updateEServiceDescription(seed, {
          params: { eServiceId: eserviceId },
          headers,
        });

      const polledResource = await pollEService(response, headers);
      return toM2MGatewayApiEService(polledResource.data);
    },

    async updatePublishedEServiceName(
      eserviceId: EServiceId,
      seed: m2mGatewayApi.EServiceNameUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(
        `Updating name for published E-Service with id ${eserviceId}`
      );

      const response = await clients.catalogProcessClient.updateEServiceName(
        seed,
        {
          params: { eServiceId: eserviceId },
          headers,
        }
      );

      const polledResource = await pollEService(response, headers);
      return toM2MGatewayApiEService(polledResource.data);
    },

    async updatePublishedEServiceSignalHub(
      eserviceId: EServiceId,
      seed: m2mGatewayApi.EServiceSignalHubUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(
        `Updating Signal Hub flag for published E-Service with id ${eserviceId}`
      );

      const response =
        await clients.catalogProcessClient.updateEServiceSignalHubFlag(seed, {
          params: { eServiceId: eserviceId },
          headers,
        });

      const polledResource = await pollEService(response, headers);
      return toM2MGatewayApiEService(polledResource.data);
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Suspending descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const response = await clients.catalogProcessClient.suspendDescriptor(
        undefined,
        {
          params: { eServiceId: eserviceId, descriptorId },
          headers,
        }
      );

      await pollEService(response, headers);

      const descriptor = retrieveEServiceDescriptorById(
        response,
        unsafeBrandId(descriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },

    async unsuspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Unsuspending descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const response = await clients.catalogProcessClient.activateDescriptor(
        undefined,
        {
          params: { eServiceId: eserviceId, descriptorId },
          headers,
        }
      );
      await pollEService(response, headers);

      const descriptor = retrieveEServiceDescriptorById(
        response,
        unsafeBrandId(descriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },

    async publishDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Publishing descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const response = await clients.catalogProcessClient.publishDescriptor(
        undefined,
        {
          params: { eServiceId: eserviceId, descriptorId },
          headers,
        }
      );
      await pollEService(response, headers);

      const descriptor = retrieveEServiceDescriptorById(
        response,
        unsafeBrandId(descriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },
    async approveDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Approving a delegated eService descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const response =
        await clients.catalogProcessClient.approveDelegatedEServiceDescriptor(
          undefined,
          {
            params: { eServiceId: eserviceId, descriptorId },
            headers,
          }
        );
      await pollEService(response, headers);

      const descriptor = retrieveEServiceDescriptorById(
        response,
        unsafeBrandId(descriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },
    async rejectDelegatedEServiceDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      body: catalogApi.RejectDelegatedEServiceDescriptorSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Rejecting a delegated eService descriptor with id ${descriptorId} for eservice with id ${eserviceId}`
      );

      const response =
        await clients.catalogProcessClient.rejectDelegatedEServiceDescriptor(
          body,
          {
            params: { eServiceId: eserviceId, descriptorId },
            headers,
          }
        );
      await pollEService(response, headers);

      const descriptor = retrieveEServiceDescriptorById(
        response,
        unsafeBrandId(descriptorId)
      );

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },
    async uploadEServiceDescriptorInterface(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      fileUpload: m2mGatewayApi.FileUploadMultipart,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Document> {
      logger.info(
        `Adding interface document ${fileUpload.file.name} to eservice ${eserviceId} descriptor ${descriptorId}`
      );

      const { data: eservice } = await retrieveEServiceById(
        headers,
        eserviceId
      );

      const { data: document, metadata } = await uploadEServiceDocument({
        eservice,
        descriptorId,
        documentKind: catalogApi.EServiceDocumentKind.Values.INTERFACE,
        fileUpload,
        fileManager,
        catalogProcessClient: clients.catalogProcessClient,
        headers,
        logger,
      });

      await pollEServiceById(eserviceId, metadata, headers);

      return toM2MGatewayApiDocument(document);
    },

    async deleteEServiceDescriptorInterface(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting interface document from eservice ${eserviceId} descriptor ${descriptorId}`
      );

      const descriptor = retrieveEServiceDescriptorById(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId
      );

      if (!descriptor.interface) {
        throw eserviceDescriptorInterfaceNotFound(eserviceId, descriptorId);
      }

      const response =
        await clients.catalogProcessClient.deleteEServiceDocumentById(
          undefined,
          {
            params: {
              eServiceId: eserviceId,
              descriptorId,
              documentId: descriptor.interface.id,
            },
            headers,
          }
        );

      await pollEService(response, headers);
    },

    async createEServiceRiskAnalysis(
      eserviceId: EServiceId,
      body: catalogApi.EServiceRiskAnalysisSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceRiskAnalysis> {
      logger.info(`Creating Risk Analysis for E-Service ${eserviceId}`);

      const {
        data: { eservice, createdRiskAnalysisId },
        metadata,
      } = await clients.catalogProcessClient.createRiskAnalysis(body, {
        params: { eServiceId: eserviceId },
        headers,
      });

      await pollEService(
        {
          data: eservice,
          metadata,
        },
        headers
      );

      const createdRiskAnalysis = retrieveEServiceRiskAnalysisById(
        { data: eservice, metadata },
        unsafeBrandId(createdRiskAnalysisId)
      );

      return toM2MGatewayApiEServiceRiskAnalysis(createdRiskAnalysis);
    },

    async updatePublishedEServiceDescriptorQuotas(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: m2mGatewayApi.EServiceDescriptorQuotasUpdateSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Updating Descriptor Quotas for published E-Service with id ${eserviceId}`
      );

      const descriptor = retrieveEServiceDescriptorById(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId
      );

      const response = await clients.catalogProcessClient.updateDescriptor(
        {
          voucherLifespan: seed.voucherLifespan ?? descriptor.voucherLifespan,
          dailyCallsPerConsumer:
            seed.dailyCallsPerConsumer ?? descriptor.dailyCallsPerConsumer,
          dailyCallsTotal: seed.dailyCallsTotal ?? descriptor.dailyCallsTotal,
        },
        {
          params: { eServiceId: eserviceId, descriptorId },
          headers,
        }
      );

      const polledResource = await pollEService(response, headers);

      return toM2MGatewayApiEServiceDescriptor(
        retrieveEServiceDescriptorById(
          polledResource,
          unsafeBrandId(descriptorId)
        )
      );
    },

    async getEServiceRiskAnalyses(
      eserviceId: EServiceId,
      { limit, offset }: m2mGatewayApi.GetEServiceRiskAnalysesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceRiskAnalyses> {
      logger.info(`Retrieving Risk Analyses for E-Service ${eserviceId}`);

      const { data: eservice } = await retrieveEServiceById(
        headers,
        eserviceId
      );

      const paginated = eservice.riskAnalysis.slice(offset, offset + limit);

      return {
        results: paginated.map(toM2MGatewayApiEServiceRiskAnalysis),
        pagination: {
          limit,
          offset,
          totalCount: eservice.riskAnalysis.length,
        },
      };
    },

    async getEServiceRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceRiskAnalysis> {
      logger.info(
        `Retrieving Risk Analysis ${riskAnalysisId} for E-Service ${eserviceId}`
      );

      const riskAnalysis = retrieveEServiceRiskAnalysisById(
        await retrieveEServiceById(headers, eserviceId),
        unsafeBrandId(riskAnalysisId)
      );

      return toM2MGatewayApiEServiceRiskAnalysis(riskAnalysis);
    },

    async deleteEServiceRiskAnalysis(
      eserviceId: EServiceId,
      riskAnalysisId: RiskAnalysisId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting Risk Analysis ${riskAnalysisId} for E-Service ${eserviceId}`
      );

      const { metadata } =
        await clients.catalogProcessClient.deleteRiskAnalysis(undefined, {
          params: { eServiceId: eserviceId, riskAnalysisId },
          headers,
        });

      await pollEServiceById(eserviceId, metadata, headers);
    },

    async getEserviceDescriptorCertifiedAttributes(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { limit, offset }: m2mGatewayApi.GetCertifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorCertifiedAttributes> {
      logger.info(
        `Retrieving Certified Attributes for E-Service ${eserviceId} Descriptor ${descriptorId}`
      );

      const eserviceAttributes = await retrieveEServiceDescriptorAttributes(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId,
        "certified",
        { offset, limit },
        headers
      );

      return {
        results: eserviceAttributes.results.map((item) => ({
          groupIndex: item.groupIndex,
          attribute: toM2MGatewayApiCertifiedAttribute({
            attribute: item.attribute,
            logger,
          }),
        })),
        pagination: {
          limit,
          offset,
          totalCount: eserviceAttributes.totalCount,
        },
      };
    },

    async getEserviceDescriptorDeclaredAttributes(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { limit, offset }: m2mGatewayApi.GetDeclaredAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorDeclaredAttributes> {
      logger.info(
        `Retrieving Declared Attributes for E-Service ${eserviceId} Descriptor ${descriptorId}`
      );

      const eserviceAttributes = await retrieveEServiceDescriptorAttributes(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId,
        "declared",
        { offset, limit },
        headers
      );

      return {
        results: eserviceAttributes.results.map((item) => ({
          groupIndex: item.groupIndex,
          attribute: toM2MGatewayApiDeclaredAttribute({
            attribute: item.attribute,
            logger,
          }),
        })),
        pagination: {
          limit,
          offset,
          totalCount: eserviceAttributes.totalCount,
        },
      };
    },

    async getEserviceDescriptorVerifiedAttributes(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      { limit, offset }: m2mGatewayApi.GetVerifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorVerifiedAttributes> {
      logger.info(
        `Retrieving Verified Attributes for E-Service ${eserviceId} Descriptor ${descriptorId}`
      );

      const eserviceAttributes = await retrieveEServiceDescriptorAttributes(
        await retrieveEServiceById(headers, eserviceId),
        descriptorId,
        "verified",
        { offset, limit },
        headers
      );

      return {
        results: eserviceAttributes.results.map((item) => ({
          groupIndex: item.groupIndex,
          attribute: toM2MGatewayApiVerifiedAttribute({
            attribute: item.attribute,
            logger,
          }),
        })),
        pagination: {
          limit,
          offset,
          totalCount: eserviceAttributes.totalCount,
        },
      };
    },

    async createEServiceDescriptorCertifiedAttributesGroup(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      attributeIds: EServiceDescriptorAttributesGroupSeed,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorCertifiedAttribute[]> {
      ctx.logger.info(
        `Creating Certified Attributes Group for E-Service ${eserviceId} Descriptor ${descriptorId}`
      );

      const { attributes, groupIndex } =
        await createEServiceDescriptorAttributesGroup(
          eserviceId,
          descriptorId,
          attributeIds,
          "certified",
          ctx
        );

      return attributes.results.map((attr) => ({
        groupIndex,
        attribute: toM2MGatewayApiCertifiedAttribute({
          attribute: attr,
          logger: ctx.logger,
        }),
      }));
    },

    async createEServiceDescriptorDeclaredAttributesGroup(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      attributeIds: EServiceDescriptorAttributesGroupSeed,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorDeclaredAttribute[]> {
      ctx.logger.info(
        `Creating Declared Attributes Group for E-Service ${eserviceId} Descriptor ${descriptorId}`
      );
      const { attributes, groupIndex } =
        await createEServiceDescriptorAttributesGroup(
          eserviceId,
          descriptorId,
          attributeIds,
          "declared",
          ctx
        );

      return attributes.results.map((attr) => ({
        groupIndex,
        attribute: toM2MGatewayApiDeclaredAttribute({
          attribute: attr,
          logger: ctx.logger,
        }),
      }));
    },

    async createEServiceDescriptorVerifiedAttributesGroup(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      attributeIds: EServiceDescriptorAttributesGroupSeed,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptorVerifiedAttribute[]> {
      ctx.logger.info(
        `Creating Verified Attributes Group for E-Service ${eserviceId} Descriptor ${descriptorId}`
      );
      const { attributes, groupIndex } =
        await createEServiceDescriptorAttributesGroup(
          eserviceId,
          descriptorId,
          attributeIds,
          "verified",
          ctx
        );

      return attributes.results.map((attr) => ({
        groupIndex,
        attribute: toM2MGatewayApiVerifiedAttribute({
          attribute: attr,
          logger: ctx.logger,
        }),
      }));
    },
  };
}
