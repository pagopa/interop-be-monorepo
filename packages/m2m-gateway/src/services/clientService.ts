import { ClientId, UserId, unsafeBrandId } from "pagopa-interop-models";
import { WithLogger } from "pagopa-interop-commons";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { clientAdminIdNotFound } from "../model/errors.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import {
  toGetClientsApiQueryParams,
  toM2MGatewayApiConsumerClient,
} from "../api/clientApiConverter.js";

export type ClientService = ReturnType<typeof clientServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientServiceBuilder(clients: PagoPAInteropBeClients) {
  const pollClient = (
    response: WithMaybeMetadata<authorizationApi.Client>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Client>> =>
    pollResourceWithMetadata(() =>
      clients.authorizationClient.client.getClient({
        params: { clientId: response.data.id },
        headers,
      })
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getClientAdminId(
      clientId: ClientId,
      {
        headers,
        logger,
      }: Pick<WithLogger<M2MGatewayAppContext>, "headers" | "logger">
    ): Promise<UserId> {
      logger.info(`Retrieving client with id ${clientId} to get its adminId`);

      const { data: client } =
        await clients.authorizationClient.client.getClient({
          params: { clientId },
          headers,
        });

      const adminId = match(client)
        .with(
          { visibility: authorizationApi.ClientVisibility.Enum.FULL },
          (c) => c.adminId
        )
        .with(
          { visibility: authorizationApi.ClientVisibility.Enum.COMPACT },
          () => undefined
        )
        .exhaustive();

      if (adminId === undefined) {
        throw clientAdminIdNotFound(client);
      }

      return unsafeBrandId<UserId>(adminId);
    },
    async getClient(
      clientId: ClientId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Client> {
      logger.info(`Retrieving client with id ${clientId}`);

      const client = await clients.authorizationClient.client.getClient({
        params: { clientId },
        headers,
      });

      return toM2MGatewayApiConsumerClient(client.data);
    },
    async getClients(
      params: m2mGatewayApi.GetClientsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Clients> {
      const { limit, offset, name, userIds, consumerId, purposeId } = params;
      logger.info(
        `Retrieving clients with name ${name}, consumerId ${consumerId}, purposeId ${purposeId}, userIds ${userIds}, offset ${offset}, limit ${limit}`
      );

      const {
        data: { results, totalCount },
      } = await clients.authorizationClient.client.getClients({
        queries: toGetClientsApiQueryParams(params),
        headers,
      });

      return {
        results: results.map(toM2MGatewayApiConsumerClient),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async createClient(
      seed: m2mGatewayApi.ClientSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Client> {
      logger.info(`Creating client with name ${seed.name}`);

      const response =
        await clients.authorizationClient.client.createConsumerClient(seed, {
          headers,
        });

      const polledResource = await pollClient(response, headers);

      return toM2MGatewayApiConsumerClient(polledResource.data);
    },
    async addClientPurpose(
      clientId: ClientId,
      seed: m2mGatewayApi.ClientAddPurpose,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Adding purpose ${seed.purposeId} to client with id ${clientId}`
      );

      const response =
        await clients.authorizationClient.client.addClientPurpose(seed, {
          params: { clientId },
          headers,
        });

      await pollClient(response, headers);
    },
  };
}
