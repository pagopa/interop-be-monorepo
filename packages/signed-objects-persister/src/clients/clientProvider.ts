import {
  agreementApi,
  delegationApi,
  purposeApi,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type PagoPAInteropBeClients = {
  agreementProcessClient: agreementApi.AgreementProcessClient;
  purposeProcessClient: purposeApi.PurposeProcessClient;
  delegationProcessClient: delegationApi.DelegationProcessClient["delegation"];
  purposeTemplateProcessClient: purposeTemplateApi.PurposeTemplateProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    delegationProcessClient: delegationApi.createDelegationApiClient(
      config.delegationProcessUrl
    ),
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
