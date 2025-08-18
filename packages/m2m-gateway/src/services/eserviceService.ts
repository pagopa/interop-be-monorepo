import { FileManager, WithLogger } from "pagopa-interop-commons";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetEServicesQueryParams,
  toM2MGatewayApiDocument,
  toM2MGatewayApiEService,
  toM2MGatewayApiEServiceDescriptor,
  toCatalogApiEServiceDescriptorSeed,
  toM2MGatewayApiEServiceRiskAnalysis,
} from "../api/eserviceApiConverter.js";
import {
  cannotDeleteLastEServiceDescriptor,
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

  const retrieveEServiceDescriptorById = async (
    headers: M2MGatewayAppContext["headers"],
    eserviceId: EServiceId,
    descriptorId: DescriptorId
  ): Promise<WithMaybeMetadata<catalogApi.EServiceDescriptor>> => {
    const { data: eservice, metadata } =
      await clients.catalogProcessClient.getEServiceById({
        params: { eServiceId: eserviceId },
        headers,
      });

    const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

    if (!descriptor) {
      throw eserviceDescriptorNotFound(eservice.id, descriptorId);
    }

    return {
      data: descriptor,
      metadata,
    };
  };

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

      const { data: eservice } = await retrieveEServiceById(
        headers,
        eserviceId
      );

      return toM2MGatewayApiEService(eservice);
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

      const { data: descriptor } = await retrieveEServiceDescriptorById(
        headers,
        eserviceId,
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

      const { data: descriptor } = await retrieveEServiceDescriptorById(
        headers,
        eserviceId,
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

      const createdDescriptor = eservice.descriptors.find(
        (d) => d.id === createdDescriptorId
      );

      if (!createdDescriptor) {
        throw eserviceDescriptorNotFound(eserviceId, createdDescriptorId);
      }

      return toM2MGatewayApiEServiceDescriptor(createdDescriptor);
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

      const descriptor = response.data.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eserviceId, descriptorId);
      }

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

      const descriptor = response.data.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eserviceId, descriptorId);
      }

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

      const descriptor = response.data.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eserviceId, descriptorId);
      }

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

      const descriptor = response.data.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eserviceId, descriptorId);
      }

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

      const descriptor = response.data.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eserviceId, descriptorId);
      }

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

      const { data: descriptor } = await retrieveEServiceDescriptorById(
        headers,
        eserviceId,
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

      const createdRiskAnalysis = eservice.riskAnalysis.find(
        (r) => r.id === createdRiskAnalysisId
      );

      if (!createdRiskAnalysis) {
        throw eserviceRiskAnalysisNotFound(eserviceId, createdRiskAnalysisId);
      }

      return toM2MGatewayApiEServiceRiskAnalysis(createdRiskAnalysis);
    },
  };
}
