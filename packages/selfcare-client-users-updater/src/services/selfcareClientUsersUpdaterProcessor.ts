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
  UserId,
  unsafeBrandId,
  SelfcareId,
  selfcareUserEventType,
  relationshipStatus,
  BaseUsersEventPayload,
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

        const userEventPayload = BaseUsersEventPayload.parse(jsonPayload);

        return match(userEventPayload)
          .with({ user: { userId: P.nullish } }, () => {
            loggerInstance.warn(
              `Skipping message for partition ${partition} with offset ${message.offset} - Missing userId.`
            );
          })
          .with(
            {
              eventType: selfcareUserEventType.update,
              user: {
                userId: P.string,
                productRole: P.when((role) => role === userRole.ADMIN_ROLE),
                relationshipStatus: P.not(relationshipStatus.active),
              },
            },
            async (payload) => {
              const eventUserId = unsafeBrandId<UserId>(payload.user.userId);
              const selfcareId = unsafeBrandId<SelfcareId>(
                payload.institutionId
              );
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
            loggerInstance.info(
              `Skipping message for partition ${partition} with offset ${message.offset} - Event type is ${userEventPayload.eventType}, user productRole is ${userEventPayload.user.productRole} and relationshipStatus is ${userEventPayload.user.relationshipStatus}.`
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
