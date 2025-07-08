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
import { assertClientVisibilityIsFull } from "../utils/validators/validators.js";
import { toM2MGatewayApiPurpose } from "../api/purposeApiConverter.js";

export type ClientService = ReturnType<typeof clientServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientServiceBuilder(clients: PagoPAInteropBeClients) {
  const retrieveClientById = (
    clientId: ClientId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Client>> =>
    clients.authorizationClient.client.getClient({
      params: { clientId },
      headers,
    });

  const pollClient = (
    response: WithMaybeMetadata<authorizationApi.Client>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Client>> =>
    pollResourceWithMetadata(() =>
      retrieveClientById(unsafeBrandId(response.data.id), headers)
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

      const { data: client } = await retrieveClientById(clientId, headers);

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
    async getClientPurposes(
      clientId: ClientId,
      { limit, offset }: m2mGatewayApi.GetClientPurposesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purposes> {
      logger.info(`Retrieving purposes for client with id ${clientId}`);

      const { data: client } = await retrieveClientById(clientId, headers);

      assertClientVisibilityIsFull(client);

      const purposes = await Promise.all(
        client.purposes.map((purposeId) =>
          clients.purposeProcessClient
            .getPurpose({
              params: { id: purposeId },
              headers,
            })
            .then(({ data: purpose }) => purpose)
        )
      );

      const paginatedPurposes = purposes.slice(offset, offset + limit);

      return {
        pagination: {
          limit,
          offset,
          totalCount: purposes.length,
        },
        results: paginatedPurposes.map(toM2MGatewayApiPurpose),
      };
    },
  };
}
