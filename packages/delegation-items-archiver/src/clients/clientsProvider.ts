import {
  agreementApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";

import { config } from "../config/config.js";

type PagoPAInteropBeClients = {
  agreementProcessClient: agreementApi.AgreementProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  catalogProcessClient: catalogApi.CatalogProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
    purposeProcessClient: purposeApi.createPurposeApiClient(
      config.purposeProcessUrl
    ),
    catalogProcessClient: catalogApi.createProcessApiClient(
      config.catalogProcessUrl
    ),
  };
}
