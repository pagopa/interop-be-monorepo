import { ZodiosInstance, ZodiosOptions } from "@zodios/core";
import { SelfCareClientConfig } from "pagopa-interop-commons";
import * as selfcareV2ClientApi from "./generated/selfcareV2ClientApi.js";

const createClientConfig = (selfcareApiKey: string): ZodiosOptions => ({
  axiosConfig: {
    headers: {
      "Ocp-Apim-Subscription-Key": selfcareApiKey,
    },
  },
});

export type SelfcareV2InstitutionClient = ZodiosInstance<
  typeof selfcareV2ClientApi.InstitutionApi.api
>;

export const selfcareV2InstitutionClientBuilder = (
  config: SelfCareClientConfig
): SelfcareV2InstitutionClient =>
  selfcareV2ClientApi.createInstitutionApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );

export type SelfcareV2DelegationClient = ZodiosInstance<
  typeof selfcareV2ClientApi.DelegationApi.api
>;

export const selfcareV2DelegationClientBuilder = (
  config: SelfCareClientConfig
): SelfcareV2DelegationClient =>
  selfcareV2ClientApi.createDelegationApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );

export type SelfcareV2UsersClient = ZodiosInstance<
  typeof selfcareV2ClientApi.UserApi.api
>;

export const selfcareV2UsersClientBuilder = (
  config: SelfCareClientConfig
): SelfcareV2UsersClient =>
  selfcareV2ClientApi.createUserApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
