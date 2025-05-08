import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeId } from "pagopa-interop-models";
import {
  toGetPurposesApiQueryParams,
  toM2MGatewayApiPurpose,
} from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  pollResource,
  isPolledVersionAtLeastResponseVersion,
} from "../utils/polling.js";

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(clients: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollPurpose = (
    response: WithMaybeMetadata<purposeApi.Purpose>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      clients.purposeProcessClient.getPurpose({
        params: { id: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    getPurposes: async (
      queryParams: m2mGatewayApi.GetPurposesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purposes> => {
      const { eserviceIds, limit, offset } = queryParams;

      logger.info(
        `Retrieving purposes for eServiceIds ${eserviceIds} limit ${limit} offset ${offset}`
      );

      const queries = toGetPurposesApiQueryParams(queryParams);

      const {
        data: { results, totalCount },
      } = await clients.purposeProcessClient.getPurposes({ queries, headers });

      return {
        results: results.map((purpose) =>
          toM2MGatewayApiPurpose({ purpose, logger, throwNotFoundError: true })
        ),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    getPurpose: async (
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> => {
      logger.info(`Retrieving purpose with id ${purposeId}`);

      const { data } = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      return toM2MGatewayApiPurpose({
        purpose: data,
        logger,
        throwNotFoundError: true,
      });
    },
    createPurpose: async (
      purposeSeed: m2mGatewayApi.PurposeSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> => {
      logger.info(`Creating purpose`);

      const purposeResponse = await clients.purposeProcessClient.createPurpose(
        purposeSeed,
        {
          headers,
        }
      );

      const polledResource = await pollPurpose(purposeResponse, headers);

      return toM2MGatewayApiPurpose({
        purpose: polledResource.data,
        logger,
      });
    },
  };
}
