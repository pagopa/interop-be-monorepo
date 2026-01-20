import { notificationConfigApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type NotificationConfigProcessClient = {
  client: ReturnType<typeof notificationConfigApi.createProcessApiClient>;
};

export type PagoPAInteropBeClients = {
  notificationConfigProcess: NotificationConfigProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    notificationConfigProcess: {
      client: notificationConfigApi.createProcessApiClient(
        config.notificationConfigProcessUrl
      ),
    },
  };
}
