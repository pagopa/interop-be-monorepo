import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { apiGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { PurposeProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import {
  toApiGatewayPurpose,
  toPurposeProcessGetPurposesQueryParams,
} from "../api/purposeApiConverter.js";

export async function getPurposes(
  purposeProcessClient: PurposeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  { eserviceId, consumerId }: apiGatewayApi.GetPurposesQueryParams
): Promise<apiGatewayApi.Purposes> {
  const getPurposesQueryParams = toPurposeProcessGetPurposesQueryParams({
    eserviceId,
    consumerId,
  });

  const purposes = await getAllFromPaginated<purposeApi.Purpose>(
    async (offset, limit) =>
      await purposeProcessClient.getPurposes({
        headers,
        queries: {
          ...getPurposesQueryParams,
          offset,
          limit,
        },
      })
  );

  return { purposes: purposes.map(toApiGatewayPurpose) };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  purposeProcessClient: PurposeProcessClient
) {
  return {
    getPurposes: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      { eserviceId, consumerId }: apiGatewayApi.GetPurposesQueryParams
    ): Promise<apiGatewayApi.Purposes> => {
      logger.info(
        `Retrieving Purposes for eservice ${eserviceId} and consumer ${consumerId}"`
      );
      return await getPurposes(purposeProcessClient, headers, {
        eserviceId,
        consumerId,
      });
    },
  };
}
