import {
  getAllFromPaginated,
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
import { bffApi } from "pagopa-interop-api-clients";
import { AuthorizationProcessClient } from "../clients/authorizationProcessClient.js";
import {
  EventType,
  RelationshipStatus,
  UsersEventPayload,
} from "../model/UsersEventPayload.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken: RefreshableInteropToken,
  authorizationProcessClient: AuthorizationProcessClient,
  productId: string
) {
  return {
    async processMessage({
      message,
      partition,
    }: EachMessagePayload): Promise<void> {
      const correlationId: CorrelationId = generateId();

      const loggerInstance = logger({
        serviceName: "selfcare-client-users-updater",
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

        if (jsonPayload.productId !== productId) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product with ID: ${jsonPayload.productId}`
          );
          return;
        }

        const userEventPayload = UsersEventPayload.parse(jsonPayload);

        if (userEventPayload.eventType !== EventType.enum.UPDATE) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required eventType: ${userEventPayload.eventType}`
          );
          return;
        }

        const token = (await refreshableToken.get()).serialized;
        const headers = getInteropHeaders({ token, correlationId });

        if (!userEventPayload.user.userId) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Missing userId.`
          );
          return;
        }

        // Note: we are interested in users who are no longer admins or admins who have lost their tenant relationship.
        if (
          userEventPayload.user.productRole === userRole.ADMIN_ROLE &&
          userEventPayload.user.relationshipStatus ===
            RelationshipStatus.enum.ACTIVE
        ) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - User is a valid admin and relationshipStatus is ${jsonPayload.user.relationshipStatus}.`
          );
          return;
        }

        const response = await getAllFromPaginated(
          async (offset, limit) =>
            await authorizationProcessClient.client.getClients({
              queries: {
                userIds: [jsonPayload.user.userId],
                consumerId: jsonPayload.institutionId,
                kind: bffApi.ClientKind.Values.API,
                offset,
                limit,
              },
              headers,
            })
        );

        const clients = response.filter(
          (client) => client.adminId === jsonPayload.user.userId
        );

        loggerInstance.info(
          `Found ${clients.length} clients with user as admin`
        );

        await Promise.all(
          clients.map(async (client) =>
            authorizationProcessClient.client.internalRemoveClientAdmin(
              undefined,
              {
                params: {
                  clientId: client.id,
                  adminId: jsonPayload.user.userId,
                },
                headers: getInteropHeaders({
                  token,
                  correlationId,
                }),
              }
            )
          )
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
