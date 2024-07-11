import { agreementApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type PagoPAInteropBeClients = {
  agreementProcessClient: AgreementProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
  };
}
