import { purposeApi } from "pagopa-interop-api-clients";

import { config } from "../configs/config.js";

type PagoPAInteropBeClients = {
  purposeProcess: {
    client: purposeApi.PurposeProcessClient;
  };
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    purposeProcess: {
      client: purposeApi.createPurposeApiClient(config.purposeProcessUrl),
    },
  };
}
