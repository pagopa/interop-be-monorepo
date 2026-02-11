import * as path from "path";
import { fileURLToPath } from "url";
import { endpointsToOpenApi } from "./generateOpenApi.js";
import {
  processEndpoints,
  TenantNotificationConfig,
  UserNotificationConfig,
  NotificationConfig,
  TenantNotificationConfigSeed,
  TenantNotificationConfigUpdateSeed,
  UserNotificationConfigSeed,
  UserNotificationConfigUpdateSeed,
  UserRole,
  Problem,
  ProblemError,
} from "./notificationConfigApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

endpointsToOpenApi({
  title: "Notification Config Process Micro Service",
  description: "This service is the notification config process",
  version: "{{version}}",
  tags: [
    {
      name: "process",
      description: "Implements notification config process",
      externalDocs: {
        description: "Find out more",
        url: "http://swagger.io",
      },
    },
    {
      name: "health",
      description: "Verify service status",
      externalDocs: {
        description: "Find out more",
        url: "http://swagger.io",
      },
    },
  ],
  servers: [
    {
      url: "/",
      description: "This service is the notification config process",
    },
  ],
  security: [{ bearerAuth: [] }],
  securitySchemes: {
    bearerAuth: {
      type: "http",
      description:
        "A bearer token in the format of a JWS and comformed to the specifications included in [RFC8725](https://tools.ietf.org/html/RFC8725).",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
  endpoints: processEndpoints,
  schemas: [
    { name: "TenantNotificationConfig", schema: TenantNotificationConfig },
    { name: "UserNotificationConfig", schema: UserNotificationConfig },
    { name: "NotificationConfig", schema: NotificationConfig },
    {
      name: "TenantNotificationConfigSeed",
      schema: TenantNotificationConfigSeed,
    },
    {
      name: "TenantNotificationConfigUpdateSeed",
      schema: TenantNotificationConfigUpdateSeed,
    },
    { name: "UserNotificationConfigSeed", schema: UserNotificationConfigSeed },
    {
      name: "UserNotificationConfigUpdateSeed",
      schema: UserNotificationConfigUpdateSeed,
    },
    { name: "UserRole", schema: UserRole },
    { name: "Problem", schema: Problem },
    { name: "ProblemError", schema: ProblemError },
  ],
  outputPath: path.resolve(
    __dirname,
    "../../open-api/notificationConfigApi.yml"
  ),
});

console.log("Generated notificationConfigApi.yml");
