import { FileManager, WithLogger } from "pagopa-interop-commons";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetEServicesQueryParams,
  toM2MGatewayApiEService,
  toM2MGatewayApiEServiceDescriptor,
} from "../api/eserviceApiConverter.js";
import {
  eserviceDescriptorInterfaceNotFound,
  eserviceDescriptorNotFound,
} from "../model/errors.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { config } from "../config/config.js";
import { DownloadedDocument, downloadDocument } from "../utils/fileDownload.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
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

  const pollEservice = (
    response: WithMaybeMetadata<catalogApi.EService>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<catalogApi.EService>> =>
    pollResourceWithMetadata(() =>
      retrieveEServiceById(headers, response.data.id as EServiceId)
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

    async suspendDescriptor(
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServiceDescriptor> {
      logger.info(
        `Suspending descriptor with id ${descriptorId} for eservice with id ${eServiceId}`
      );

      const response = await clients.catalogProcessClient.suspendDescriptor(
        undefined,
        {
          params: { eServiceId, descriptorId },
          headers,
        }
      );

      await pollEservice(response, headers);

      const descriptor = response.data.descriptors.find(
        (d) => d.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eServiceId, descriptorId);
      }

      return toM2MGatewayApiEServiceDescriptor(descriptor);
    },
  };
}
