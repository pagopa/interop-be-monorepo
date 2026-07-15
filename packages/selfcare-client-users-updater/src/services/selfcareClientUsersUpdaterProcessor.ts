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
  relationshipStatus,
  BaseUsersEventPayload,
  UsersEventPayload,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { authorizationApi } from "pagopa-interop-api-clients";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken: RefreshableInteropToken,
  authorizationProcessClient: Pick<
    authorizationApi.AuthorizationProcessClient,
    "client"
  >,
  readModelService: ReadModelServiceSQL,
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

        const jsonPayload = JSON.parse(message.value.toString());

        // Process only messages of our product
        // Note: doing this before parsing to avoid errors on messages of other products
        if (jsonPayload.productId !== productId) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${jsonPayload.productId}`
          );
          return;
        }

        // Validate first so a malformed payload fails loudly while a missing
        // userId is skipped; only then apply the shared transform.
        const baseEventPayload = BaseUsersEventPayload.parse(jsonPayload);
        if (baseEventPayload.user.userId == null) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Missing userId.`
          );
          return;
        }

        const userEventPayload = UsersEventPayload.parse(jsonPayload);

        return match(userEventPayload)
          .with(
            {
              eventType: P.union("update", "delete"),
              user: {
                productRole: userRole.ADMIN_ROLE,
                relationshipStatus: P.not(relationshipStatus.active),
              },
            },
            async (payload) => {
              const eventUserId = payload.user.userId;
              const selfcareId = payload.institutionId;
              const token = (await refreshableToken.get()).serialized;
              const tenantId =
                await readModelService.getTenantIdBySelfcareId(selfcareId);

              if (!tenantId) {
                loggerInstance.warn(
                  `Skipping message for partition ${partition} with offset ${message.offset} - Tenant not found for selfcareId: ${selfcareId}`
                );
                return;
              }

              const clients = await readModelService.getClients({
                consumerId: tenantId,
                adminId: eventUserId,
              });

              await Promise.all(
                clients.map(async (client) => {
                  loggerInstance.info(
                    `Removing admin ${eventUserId} from client ${client.id}`
                  );
                  return authorizationProcessClient.client.internalRemoveClientAdmin(
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
                  );
                })
              );

              loggerInstance.info(
                `Message in partition ${partition} with offset ${message.offset} correctly consumed. SelfcareId: ${selfcareId}`
              );
            }
          )
          .otherwise(() => {
            // baseEventPayload.eventType: log the raw event type, not the
            // simplified one.
            loggerInstance.info(
              `Skipping message for partition ${partition} with offset ${message.offset} - Event type is ${baseEventPayload.eventType}, user productRole is ${userEventPayload.user.productRole} and relationshipStatus is ${userEventPayload.user.relationshipStatus}.`
            );
          });
      } catch (err) {
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
      }
    },
  };
}
