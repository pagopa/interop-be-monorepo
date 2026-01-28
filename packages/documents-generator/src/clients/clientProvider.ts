import {
  agreementApi,
  delegationApi,
  purposeApi,
  purposeTemplateApi,
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
export type PurposeTemplateProcessClient = ReturnType<
  typeof purposeTemplateApi.createPurposeTemplateApiClient
>;

export type PagoPAInteropBeClients = {
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
  delegationProcessClient: DelegationProcessClient;
  purposeTemplateProcessClient: PurposeTemplateProcessClient;
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
    purposeTemplateProcessClient:
      purposeTemplateApi.createPurposeTemplateApiClient(
        config.purposeTemplateProcessUrl
      ),
  };
}
