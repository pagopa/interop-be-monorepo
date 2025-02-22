import { catalogApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type CatalogProcessClient = {
  client: ReturnType<typeof catalogApi.createProcessApiClient>;
};

export type PagoPAInteropBeClients = {
  catalogProcess: CatalogProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    catalogProcess: {
      client: catalogApi.createProcessApiClient(config.catalogProcessUrl),
    },
  };
}
