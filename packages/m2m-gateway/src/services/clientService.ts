import { ClientId, UserId, unsafeBrandId } from "pagopa-interop-models";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { clientAdminIdNotFound } from "../model/errors.js";

export type ClientService = ReturnType<typeof clientServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    /**
     * Get the admin user ID for a given client ID.
     * This method is used by the m2mAuthDataValidationMiddleware to validate
     * that the userId in the JWT token is the same as the adminId associated
     * with the client associated with the token.
     */
    async getClientAdminId(
      clientId: ClientId,
      {
        headers,
        logger,
      }: Pick<WithLogger<M2MGatewayAppContext>, "headers" | "logger">
    ): Promise<UserId> {
      logger.info(`Retrieving client with id ${clientId} to get its adminId`);

      const client = await clients.authorizationClient.client.getClient({
        params: { clientId },
        headers,
      });

      if (client.data.adminId === undefined) {
        throw clientAdminIdNotFound(client.data);
      }

      return unsafeBrandId<UserId>(client.data.adminId);
    },
  };
}
