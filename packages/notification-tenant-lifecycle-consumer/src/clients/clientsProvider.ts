import { notificationConfigApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type NotificationConfigProcessClient = {
  client: notificationConfigApi.NotificationConfigProcessClient;
};

export type PagoPAInteropBeClients = {
  notificationConfigProcess: NotificationConfigProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    notificationConfigProcess: {
      client: notificationConfigApi.createNotificationConfigClient(
        config.notificationConfigProcessUrl
      ),
    },
  };
}
