import {
  createClient,
  createConfig,
} from "./generated/hey-api/notificationConfigApi/client/index.js";
import { configureHeyApiLogInterceptors } from "./heyApiLogInterceptors.js";

export * from "./generated/hey-api/notificationConfigApi/zod.gen.js";
export * from "./generated/hey-api/notificationConfigApi/sdk.gen.js";
export type * from "./generated/hey-api/notificationConfigApi/types.gen.js";
export type { RouteHandlers as NotificationConfigRouteHandlers } from "./generated/hey-api/notificationConfigApi/fastify.gen.js";
export { operationRoutes as notificationConfigOperationRoutes } from "./generated/hey-api/notificationConfigApi/routes.gen.js";
export { client as heyApiClient } from "./generated/hey-api/notificationConfigApi/client.gen.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createNotificationConfigClient(baseUrl: string) {
  const clientInstance = createClient(
    createConfig({
      baseUrl,
    })
  );

  configureHeyApiLogInterceptors(clientInstance, "NotificationConfig Client");

  return clientInstance;
}

export type NotificationConfigHeyApiClient = ReturnType<
  typeof createNotificationConfigClient
>;
