import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { apiGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  CatalogProcessClient,
  PurposeProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import {
  toApiGatewayPurpose,
  toPurposeProcessGetPurposesQueryParams,
} from "../api/purposeApiConverter.js";
import { assertIsEserviceProducer } from "./validators.js";

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
  purposeProcessClient: PurposeProcessClient,
  catalogProcessClient: CatalogProcessClient
) {
  return {
    getPurpose: async (
      {
        logger,
        headers,
        authData: { organizationId },
      }: WithLogger<ApiGatewayAppContext>,
      purposeId: purposeApi.Purpose["id"]
    ): Promise<apiGatewayApi.Purpose> => {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await purposeProcessClient.getPurpose({
        headers,
        params: {
          id: purposeId,
        },
      });

      if (purpose.consumerId !== organizationId) {
        const eservice = await catalogProcessClient.getEServiceById({
          headers,
          params: {
            eServiceId: purpose.eserviceId,
          },
        });

        assertIsEserviceProducer(eservice, organizationId);
      }

      return toApiGatewayPurpose(purpose);
    },

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
