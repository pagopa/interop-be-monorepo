import {
  catalogApi,
  eserviceTemplateApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { config } from "../configs/config.js";

type PagoPAInteropBeClients = {
  catalogProcess: {
    client: catalogApi.CatalogProcessClient;
  };
  purposeProcess: {
    client: purposeApi.PurposeProcessClient;
  };
  eserviceTemplateProcess: {
    client: eserviceTemplateApi.EServiceTemplateProcessClient;
  };
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    catalogProcess: {
      client: catalogApi.createProcessApiClient(config.catalogProcessUrl),
    },
    purposeProcess: {
      client: purposeApi.createPurposeApiClient(config.purposeProcessUrl),
    },
    eserviceTemplateProcess: {
      client: eserviceTemplateApi.createProcessApiClient(
        config.eserviceTemplateProcessUrl
      ),
    },
  };
}
