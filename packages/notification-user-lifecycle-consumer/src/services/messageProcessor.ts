import { delay, logger, RefreshableInteropToken } from "pagopa-interop-commons";
import {
  genericInternalError,
  generateId,
  CorrelationId,
  TenantId,
} from "pagopa-interop-models";
import { EachMessagePayload } from "kafkajs";
import { match } from "ts-pattern";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { UsersEventPayload } from "../model/UsersEventPayload.js";
import { userRoleToApiUserRole } from "../model/apiConverter.js";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

function jsonSafeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}

// eslint-disable-next-line max-params
export async function processUserEvent(
  payload: UsersEventPayload,
  readModelServiceSQL: ReadModelServiceSQL,
  notificationConfigProcessClient: notificationConfigApi.NotificationConfigProcessClient,
  refreshableToken: RefreshableInteropToken,
  loggerInstance: ReturnType<typeof logger>,
  correlationId: CorrelationId
): Promise<void> {
  const userId = payload.user.userId;
  const institutionId = payload.institutionId;
  const productRole = payload.user.productRole;

  // eslint-disable-next-line functional/no-let
  let tenantId: TenantId | undefined;
  // eslint-disable-next-line functional/no-let
  for (let attempt = 0; attempt < config.tenantLookupMaxRetries; attempt++) {
    tenantId = await readModelServiceSQL.getTenantIdBySelfcareId(institutionId);
    if (tenantId) {
      break;
    }
    loggerInstance.warn(
      `Tenant not found for selfcareId ${institutionId}, attempt ${
        attempt + 1
      }/${config.tenantLookupMaxRetries}`
    );
    await delay(config.tenantLookupRetryDelayMs);
  }

  if (!tenantId) {
    throw genericInternalError(
      `Tenant not found for selfcareId: ${institutionId}`
    );
  }

  await match(payload.eventType)
    .with("add", "update", async () => {
      loggerInstance.info(
        `Received ${payload.eventType} for user id ${userId} in tenant ${tenantId} with role ${productRole}`
      );

      const { error } =
        await notificationConfigApi.ensureUserNotificationConfigExistsWithRoles(
          {
            body: {
              userId,
              tenantId,
              userRoles: [userRoleToApiUserRole(productRole)],
            },
            headers: {
              "X-Correlation-Id": correlationId,
              Authorization: `Bearer ${
                (
                  await refreshableToken.get()
                ).serialized
              }`,
            },
            client: notificationConfigProcessClient,
          }
        );

      if (error) {
        throw genericInternalError(
          `Error in request to ensure a notification config exists for user ${userId} in tenant ${tenantId} with role ${productRole}. Reason: ${error.status} - ${error.title}`
        );
      }
    })
    .with("delete", async () => {
      loggerInstance.info(
        `Removing role ${productRole} from notification config for user ${userId} in tenant ${tenantId}`
      );

      const { error } =
        await notificationConfigApi.removeUserNotificationConfigRole({
          path: {
            userId,
            tenantId,
            userRole: userRoleToApiUserRole(productRole),
          },
          headers: {
            "X-Correlation-Id": correlationId,
            Authorization: `Bearer ${
              (
                await refreshableToken.get()
              ).serialized
            }`,
          },
          client: notificationConfigProcessClient,
        });

      if (error) {
        if (error.status === 404) {
          loggerInstance.info(
            `Notification config for user ${userId} and tenant ${tenantId} not found or role ${productRole} already missing, nothing to be done`
          );
        } else {
          throw genericInternalError(
            `Error removing role ${productRole} from notification config for user ${userId} in tenant ${tenantId}. Reason: ${error.status} - ${error.title}`
          );
        }
      }
    })
    .exhaustive();
}

export function messageProcessorBuilder(
  readModelServiceSQL: ReadModelServiceSQL,
  notificationConfigProcessClient: notificationConfigApi.NotificationConfigProcessClient,
  refreshableToken: RefreshableInteropToken
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
          notificationConfigProcessClient,
          refreshableToken,
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
