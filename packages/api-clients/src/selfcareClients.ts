import { ZodiosInstance, ZodiosOptions } from "@zodios/core";
import { SelfCareConfig } from "pagopa-interop-commons";
import {
  InstitutionApi,
  DelegationApi,
  UserApi,
  createInstitutionApiClient,
  createDelegationApiClient,
  createUserApiClient,
} from "./generated/selfcareV2ClientApi.js";

const createClientConfig = (selfcareApiKey: string): ZodiosOptions => ({
  axiosConfig: {
    headers: {
      "Ocp-Apim-Subscription-Key": selfcareApiKey,
    },
  },
});

export type SelfcareV2InstitutionClient = ZodiosInstance<
  typeof InstitutionApi.api
>;

export const selfcareV2InstitutionClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InstitutionClient =>
  createInstitutionApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );

export type SelfcareV2DelegationClient = ZodiosInstance<
  typeof DelegationApi.api
>;

export const selfcareV2DelegationClientBuilder = (
  config: SelfCareConfig
): SelfcareV2DelegationClient =>
  createDelegationApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );

export type SelfcareV2UsersClient = ZodiosInstance<typeof UserApi.api>;

export const selfcareV2UsersClientBuilder = (
  config: SelfCareConfig
): SelfcareV2UsersClient =>
  createUserApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
