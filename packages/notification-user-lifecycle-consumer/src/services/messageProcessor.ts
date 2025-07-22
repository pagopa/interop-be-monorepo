import { InteropTokenGenerator, logger } from "pagopa-interop-commons";
import {
  unsafeBrandId,
  genericInternalError,
  generateId,
} from "pagopa-interop-models";
import type { UserId, SelfcareId, CorrelationId } from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { match } from "ts-pattern";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { UsersEventPayload } from "../model/UsersEventPayload.js";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import { UserServiceSQL } from "./userServiceSQL.js";

// eslint-disable-next-line max-params
export async function processUserEvent(
  payload: UsersEventPayload,
  readModelServiceSQL: ReadModelServiceSQL,
  userServiceSQL: UserServiceSQL,
  notificationConfigProcessClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  interopTokenGenerator: InteropTokenGenerator,
  loggerInstance: ReturnType<typeof logger>,
  correlationId: CorrelationId
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

  // TODO try catch process call error
  await match(action)
    .with("add", async () => {
      loggerInstance.info(`Add user id ${userId} from tenant ${tenantId}`);

      const { serialized } =
        await interopTokenGenerator.generateInternalToken();
      await notificationConfigProcessClient.createUserDefaultNotificationConfig(
        {
          userId,
          tenantId,
        },
        {
          headers: {
            "X-Correlation-Id": correlationId,
            Authorization: `Bearer ${serialized}`,
          },
        }
      );

      return userServiceSQL.insertUser(userData);
    })
    .with("update", async () => {
      loggerInstance.info(`Update user id ${userId} from tenant ${tenantId}`);
      return userServiceSQL.updateUser(userData);
    })
    .with("delete", async () => {
      loggerInstance.info(`Removing user ${userId} from tenant ${tenantId}`);
      const { serialized } =
        await interopTokenGenerator.generateInternalToken();
      await notificationConfigProcessClient.deleteUserNotificationConfig(
        undefined,
        {
          params: {
            userId,
            tenantId,
          },
          headers: {
            "X-Correlation-Id": correlationId,
            Authorization: `Bearer ${serialized}`,
          },
        }
      );
      return userServiceSQL.deleteUser(userId);
    })
    .exhaustive();
}

function jsonSafeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}

export function messageProcessorBuilder(
  readModelServiceSQL: ReadModelServiceSQL,
  userServiceSQL: UserServiceSQL,
  notificationConfigProcessClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  interopTokenGenerator: InteropTokenGenerator
): { processMessage: (payload: EachMessagePayload) => Promise<void> } {
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

        const payload = jsonSafeParse(message.value?.toString() ?? "");

        const userEventPayload = UsersEventPayload.safeParse(payload);

        if (!userEventPayload.success) {
          loggerInstance.warn(
            `Skipping message for partition ${partition} with offset ${message.offset} - Invalid payload. ${userEventPayload.error}`
          );
          return;
        }

        if (userEventPayload.data.productId !== config.interopProduct) {
          loggerInstance.info(
            `Skipping message for partition ${partition} with offset ${message.offset} - Not required product: ${userEventPayload.data.productId}`
          );
          return;
        }

        await processUserEvent(
          userEventPayload.data,
          readModelServiceSQL,
          userServiceSQL,
          notificationConfigProcessClient,
          interopTokenGenerator,
          loggerInstance,
          correlationId
        );
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
