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
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  selfcareUserEventType,
  UsersEventPayload,
  relationshipStatus,
} from "../model/UsersEventPayload.js";
import { AuthorizationProcessClient } from "../clients/authorizationProcessClient.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken: RefreshableInteropToken,
  authorizationProcessClient: AuthorizationProcessClient,
  readModelService: ReadModelService,
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
        const userEventPayload = UsersEventPayload.parse(
          JSON.parse(stringPayload)
        );

        return match(userEventPayload)
          .with({ productId: P.not(productId) }, () => {
            loggerInstance.info(
              `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${userEventPayload.productId}`
            );
          })
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
              const eventUserId = payload.user.userId;
              const token = (await refreshableToken.get()).serialized;
              const clients = await readModelService.getClients({
                consumerId: unsafeBrandId(userEventPayload.institutionId),
                adminId: unsafeBrandId<UserId>(eventUserId),
              });

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
                `Message in partition ${partition} with offset ${message.offset} correctly consumed. SelfcareId: ${userEventPayload.institutionId}`
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
