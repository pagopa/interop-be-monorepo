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
    async removeClientPurpose(
      clientId: ClientId,
      purposeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Removing purpose ${purposeId} from client with id ${clientId}`
      );

      const response =
        await clients.authorizationClient.client.removeClientPurpose(
          undefined,
          {
            params: { clientId, purposeId },
            headers,
          }
        );

      await pollClient(response, headers);
    },
  };
}
