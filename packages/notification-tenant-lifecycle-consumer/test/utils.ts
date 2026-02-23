import { RefreshableInteropToken } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { notificationTenantLifecycleConsumerServiceBuilder } from "../src/notificationTenantLifecycleConsumerService.js";

export const interopBeClients = {
  notificationConfigProcess: {
    client: {},
  },
} as PagoPAInteropBeClients;

export const refreshableToken = {} as RefreshableInteropToken;

export const notificationTenantLifecycleConsumerService =
  notificationTenantLifecycleConsumerServiceBuilder(
    refreshableToken,
    interopBeClients
  );
