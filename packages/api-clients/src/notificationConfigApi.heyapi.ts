import { genericLogger } from "pagopa-interop-commons";
import {
  createClient,
  createConfig,
} from "./generated/hey-api/notificationConfigApi/client/index.js";

export * from "./generated/hey-api/notificationConfigApi/zod.gen.js";
export * from "./generated/hey-api/notificationConfigApi/sdk.gen.js";
export type * from "./generated/hey-api/notificationConfigApi/types.gen.js";
export { client as heyApiClient } from "./generated/hey-api/notificationConfigApi/client.gen.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createNotificationConfigClient(baseUrl: string) {
  const clientInstance = createClient(
    createConfig({
      baseUrl,
    })
  );

  clientInstance.interceptors.response.use((response, request) => {
    const method = request.method;
    const url = request.url;
    const correlationId = request.headers?.get("X-Correlation-Id");
    const prefix = correlationId ? `[CID=${correlationId}]` : "";

    if (response.ok) {
      genericLogger.info(
        `${prefix}[NotificationConfig Client] ${method.toUpperCase()} ${url} - ${
          response.status
        }`
      );
    } else if (response.status >= 400 && response.status < 500) {
      genericLogger.warn(
        `${prefix}[NotificationConfig Client] ${method.toUpperCase()} ${url} - ${
          response.status
        }`
      );
    } else {
      genericLogger.error(
        `${prefix}[NotificationConfig Client] ${method.toUpperCase()} ${url} - ${
          response.status
        }`
      );
    }
    return response;
  });

  return clientInstance;
}

export type NotificationConfigHeyApiClient = ReturnType<
  typeof createNotificationConfigClient
>;
