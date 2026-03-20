import { catalogApi } from "pagopa-interop-api-clients";
import { config } from "../configs/config.js";

type PagoPAInteropBeClients = {
  catalogProcess: {
    client: catalogApi.CatalogProcessClient;
  };
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    catalogProcess: {
      client: catalogApi.createProcessApiClient(config.catalogProcessUrl),
    },
  };
}
