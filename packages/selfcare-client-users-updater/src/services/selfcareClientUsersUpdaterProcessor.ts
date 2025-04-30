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
  selfcareUserEventType,
  UsersEventPayload,
  relationshipStatus,
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
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${jsonPayload.product}`
          );
          return;
        }

        const userEventPayload = UsersEventPayload.parse(jsonPayload);
        const eventUserId = userEventPayload.user.userId;
        if (!eventUserId) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Missing userId.`
          );
          return;
        }

        if (
          userEventPayload.eventType === selfcareUserEventType.update &&
          userEventPayload.user.productRole === userRole.ADMIN_ROLE &&
          userEventPayload.user.relationshipStatus !== relationshipStatus.active
        ) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - User is a valid admin and relationshipStatus is ${jsonPayload.user.relationshipStatus}.`
          );
          return;
        }

        const token = (await refreshableToken.get()).serialized;
        const headers = getInteropHeaders({ token, correlationId });
        const response = await getAllFromPaginated(
          async (offset, limit) =>
            await authorizationProcessClient.client.getClients({
              queries: {
                userIds: [],
                consumerId: jsonPayload.institutionId,
                kind: bffApi.ClientKind.Values.API,
                offset,
                limit,
              },
              headers,
            })
        );

        const clients = response.filter(
          (client) => client.adminId === eventUserId
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
                  adminId: eventUserId,
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
