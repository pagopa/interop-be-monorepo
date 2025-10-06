import {
  agreementApi,
  delegationApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type AgreementProcessClient = ReturnType<
  typeof agreementApi.createAgreementApiClient
>;

export type PurposeProcessClient = ReturnType<
  typeof purposeApi.createPurposeApiClient
>;

export type DelegationProcessClient = {
  producer: ReturnType<typeof delegationApi.createProducerApiClient>;
  consumer: ReturnType<typeof delegationApi.createConsumerApiClient>;
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
      producer: delegationApi.createProducerApiClient(
        config.delegationProcessUrl
      ),
      consumer: delegationApi.createConsumerApiClient(
        config.delegationProcessUrl
      ),
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
