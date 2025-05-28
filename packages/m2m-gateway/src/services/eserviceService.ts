import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetEServicesQueryParams,
  toM2MGatewayApiEService,
  toM2MGatewayApiEServiceDescriptor,
} from "../api/eserviceApiConverter.js";
import { eserviceDescriptorNotFound } from "../model/errors.js";

export type EserviceService = ReturnType<typeof eserviceServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getEService(
      eserviceId: EServiceId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EService> {
      logger.info(`Retrieving eservice with id ${eserviceId}`);

      const response = await clients.catalogProcessClient.getEServiceById({
        params: { eServiceId: eserviceId },
        headers,
      });

      return toM2MGatewayApiEService(response.data);
    },
    async getEServices(
      params: m2mGatewayApi.GetEServicesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.EServices> {
      logger.info(
        `Retrieving eservices with producerIds ${params.producerIds} templateIds ${params.templateIds} offset ${params.offset} limit ${params.limit}`
      );

      const response = await clients.catalogProcessClient.getEServices({
        queries: toGetEServicesQueryParams(params),
        headers,
      });

      const results = response.data.results.map(toM2MGatewayApiEService);

      return {
        pagination: {
          limit: params.limit,
          offset: params.offset,
          totalCount: response.data.totalCount,
        },
        results,
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

      const { data: eservice } =
        await clients.catalogProcessClient.getEServiceById({
          params: { eServiceId: eserviceId },
          headers,
        });

      const descriptor = eservice.descriptors.find(
        (e) => e.id === descriptorId
      );

      if (!descriptor) {
        throw eserviceDescriptorNotFound(eservice.id, descriptorId);
      }

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
  };
}
