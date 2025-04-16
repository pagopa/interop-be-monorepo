import {
  getInteropHeaders,
  logger,
  RefreshableInteropToken,
  userRole,
} from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import {
  generateId,
  CorrelationId,
  genericInternalError,
} from "pagopa-interop-models";
import { AuthorizationProcessClient } from "../clients/authorizationProcessClient.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken: RefreshableInteropToken,
  authorizationProcessClient: AuthorizationProcessClient,
  productId: string,
  allowedOriginsUuid: string[]
) {
  return {
    async processMessage({
      message,
      partition,
    }: EachMessagePayload): Promise<void> {
      const correlationId: CorrelationId = generateId();

      const loggerInstance = logger({
        serviceName: "selfcare-client-users-updater-consumer",
        correlationId,
      });

      try {
        loggerInstance.info(
          `Consuming message for partition ${partition} with offset ${message.offset}`
        );

        if (!message.value) {
          loggerInstance.warn(
            `Empty message for partition ${partition} with offset ${message.offset}`
          );
          return;
        }

        const stringPayload = message.value.toString();
        const jsonPayload = JSON.parse(stringPayload);

        // Process only messages of our product
        // Note: doing this before parsing to avoid errors on messages of other products
        if (jsonPayload.productId !== productId) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${jsonPayload.productId}`
          );
          return;
        }

        if (jsonPayload.eventType !== "UPDATE") {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required eventType: ${jsonPayload.eventType}`
          );
          return;
        }

        if (!allowedOriginsUuid.includes(jsonPayload.institutionId)) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not allowed origin.`
          );
          return;
        }

        // Note: not interested in users that are admin (they can be admin in a client) and that are active in that client
        // We are interested in users that are not admin (lost admin role) or that are admin but not active in that client (lost tenant relationship)
        if (
          jsonPayload.user.productRole === userRole.ADMIN_ROLE &&
          jsonPayload.user.relationshipStatus === "ACTIVE"
        ) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - User is a valid admin and relationshipStatus is ${jsonPayload.user.relationshipStatus}.`
          );
          return;
        }

        const token = (await refreshableToken.get()).serialized;
        const headers = getInteropHeaders({ token, correlationId });

        const response = await authorizationProcessClient.client.getClients({
          queries: {
            userIds: [jsonPayload.user.userId],
            consumerId: jsonPayload.institutionId,
            kind: "API",
            offset: 0,
            limit: 50,
          },
          headers,
        });

        const clients = response.results.filter(
          (client) => client.adminId === jsonPayload.user.userId
        );

        // todo per ogni client, faccio una chiamata verso auth-process di rimozione dell'userId da quel clientId

        loggerInstance.info(
          `Found ${clients.length} clients with user as admin`
        );

        loggerInstance.info(
          `Message in partition ${partition} with offset ${message.offset} correctly consumed. SelfcareId: ${jsonPayload.institutionId}`
        );
      } catch (err) {
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
      }
    },
  };
}
