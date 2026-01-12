import {
  agreementApi,
  delegationApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

type DelegationProcessClient = {
  delegation: ReturnType<typeof delegationApi.createDelegationApiClient>;
};

export type PagoPAInteropBeClients = {
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
  delegationProcessClient: DelegationProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    delegationProcessClient: {
      delegation: delegationApi.createDelegationApiClient(
        config.delegationProcessUrl
      ),
    },
    purposeProcessClient: purposeApi.createPurposeApiClient(
      config.purposeProcessUrl
    ),
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
  };
}
