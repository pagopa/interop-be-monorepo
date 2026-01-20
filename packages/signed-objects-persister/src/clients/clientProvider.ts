import {
  agreementApi,
  delegationApi,
  purposeApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

export type PurposeTemplateProcessClient = ReturnType<
  typeof purposeTemplateApi.createPurposeTemplateApiClient
>;

export type DelegationProcessClient = {
  delegation: ReturnType<typeof delegationApi.createDelegationApiClient>;
};

type PagoPAInteropBeClients = {
  agreementProcessClient: agreementApi.AgreementProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  purposeTemplateProcessClient: PurposeTemplateProcessClient;
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
    purposeTemplateProcessClient:
      purposeTemplateApi.createPurposeTemplateApiClient(
        config.purposeTemplateProcessUrl
      ),
    agreementProcessClient: agreementApi.createAgreementApiClient(
      config.agreementProcessUrl
    ),
  };
}
