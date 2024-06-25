import { authorizationApi } from "pagopa-interop-api-clients";
import { AuthorizationProcessClient } from "../providers/clientProvider.js";

export const getAllClients = async (
  authorizationProcessClient: AuthorizationProcessClient,
  consumerId: string,
  purposeId: string,
  headers: { "X-Correlation-Id": string }
): Promise<authorizationApi.Client[]> => {
  const getClientsFrom = async (
    start: number
  ): Promise<authorizationApi.Clients> =>
    await authorizationProcessClient.client.getClients({
      headers,
      queries: {
        userIds: "",
        consumerId,
        purposeId,
        limit: 50,
        offset: start,
      },
    });

  // Fetched all agreements in a recursive way
  const getClients = async (
    start: number
  ): Promise<authorizationApi.Client[]> => {
    const clients = (await getClientsFrom(start)).results;

    if (clients.length >= 50) {
      return clients.concat(await getClients(start + 50));
    }
    return clients;
  };

  return await getClients(0);
};
