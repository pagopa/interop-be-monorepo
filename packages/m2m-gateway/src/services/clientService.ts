import { ClientId, UserId, unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type ClientService = ReturnType<typeof clientServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getClientAdminId(
      clientId: ClientId,
      headers: M2MGatewayAppContext["headers"]
    ): Promise<UserId | undefined> {
      const client = await clients.authorizationClient.client.getClient({
        params: { clientId },
        headers,
      });
      return client.data.adminId
        ? unsafeBrandId<UserId>(client.data.adminId)
        : undefined;
    },
  };
}
