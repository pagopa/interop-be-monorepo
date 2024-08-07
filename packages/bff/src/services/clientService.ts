import { authorizationApi } from "pagopa-interop-api-clients";
import { getAllFromPaginated } from "pagopa-interop-commons";
import { AuthorizationProcessClient } from "../providers/clientProvider.js";

export const getAllClients = async (
  authorizationProcessClient: AuthorizationProcessClient,
  consumerId: string,
  purposeId: string,
  headers: { "X-Correlation-Id": string }
): Promise<authorizationApi.ClientWithKeys[]> =>
  await getAllFromPaginated(
    async (start: number) =>
      await authorizationProcessClient.client.getClientsWithKeys({
        headers,
        queries: {
          userIds: [],
          consumerId,
          purposeId,
          limit: 50,
          offset: start,
        },
      })
  );
