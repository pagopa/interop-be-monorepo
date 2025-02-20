import { catalogApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type CatalogProcessClient = {
  client: ReturnType<typeof catalogApi.createProcessApiClient>;
};

export type EServiceTemplateProcessClient = {
  eserviceTemplate: ReturnType<
    typeof eserviceTemplateApi.createProcessApiClient
  >;
};

export type PagoPAInteropBeClients = {
  catalogProcess: CatalogProcessClient;
  eserviceTemplateProcess: EServiceTemplateProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    catalogProcess: {
      client: catalogApi.createProcessApiClient(config.catalogUrl),
    },
    eserviceTemplateProcess: {
      eserviceTemplate: eserviceTemplateApi.createProcessApiClient(
        config.eserviceTemplateUrl
      ),
    },
  };
}
