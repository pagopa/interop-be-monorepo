import { logger } from "pagopa-interop-commons";
import {
  unsafeBrandId,
  genericInternalError,
  generateId,
} from "pagopa-interop-models";
import type { UserId, SelfcareId, CorrelationId } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { match } from "ts-pattern";
import { UsersEventPayload } from "../model/UsersEventPayload.js";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { UserServiceSQL } from "./userServiceSQL.js";

export function messageProcessorBuilder(
  readModelServiceSQL: ReadModelServiceSQL,
  userServiceSQL: UserServiceSQL
): { processMessage: (payload: EachMessagePayload) => Promise<void> } {
  async function processUserEvent(
    payload: UsersEventPayload,
    loggerInstance: ReturnType<typeof logger>
  ): Promise<void> {
    const userId = unsafeBrandId<UserId>(payload.user.userId);
    const institutionId = unsafeBrandId<SelfcareId>(payload.institutionId);
    const action = payload.eventType;
    const tenantId = await readModelServiceSQL.getTenantIdBySelfcareId(
      institutionId
    );

    if (!tenantId) {
      throw genericInternalError(
        `Tenant not found for selfcareId: ${institutionId}`
      );
    }

    const userData = {
      userId,
      tenantId,
      institutionId,
      name: payload.user.name,
      familyName: payload.user.familyName,
      email: payload.user.email,
      productRole: payload.user.productRole,
    };

    await match(action)
      .with("add", () => {
        loggerInstance.info(`Add user id ${userId} from tenant ${tenantId}`);
        return userServiceSQL.insertUser(userData);
      })
      .with("update", () => {
        loggerInstance.info(`Update user id ${userId} from tenant ${tenantId}`);
        return userServiceSQL.updateUser(userData);
      })
      .with("delete", () => {
        loggerInstance.info(`Removing admin ${userId} from tenant ${tenantId}`);
        return userServiceSQL.deleteUser(userId);
      })
      .exhaustive();
  }

  return {
    processMessage: async ({
      message,
      partition,
    }: EachMessagePayload): Promise<void> => {
      const correlationId: CorrelationId = generateId();

      const loggerInstance = logger({
        serviceName: "selfcare-client-users-updater",
        correlationId,
      });

      try {
        loggerInstance.info(
          `Consuming message for partition ${partition} with offset ${message.offset}`
        );

        const userEventPayload = UsersEventPayload.safeParse(
          JSON.parse(message?.value?.toString() ?? "")
        );

        if (!userEventPayload.success) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Invalid payload.`
          );
          return;
        }

        if (userEventPayload.data.productId !== config.interopProduct) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${userEventPayload.data.productId}`
          );
          return;
        }

        await processUserEvent(userEventPayload.data, loggerInstance);
        loggerInstance.info(
          `Message in partition ${partition} with offset ${message.offset} correctly consumed. SelfcareId: ${userEventPayload.data.institutionId}`
        );
      } catch (err) {
        throw genericInternalError(
          `Error consuming message in partition ${partition} with offset ${message.offset}. Reason: ${err}`
        );
      }
    },
  };
}

export type MessageProcessor = ReturnType<typeof messageProcessorBuilder>;
