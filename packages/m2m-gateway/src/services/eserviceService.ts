import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { EServiceId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import {
  toGetEServicesQueryParams,
  toM2MGatewayApiEService,
} from "../api/eserviceApiConverter.js";

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
        `Retrieving eservices with producersIds ${params.producersIds} templatesIds ${params.templatesIds} offset ${params.offset} limit ${params.limit}`
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
  };
}
