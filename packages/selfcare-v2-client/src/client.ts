import { ZodiosInstance } from "@zodios/core";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { SelfCareConfig } from "./config/selfcareConfig.js";

export type SelfcareV2InstitutionClient = ZodiosInstance<
  typeof selfcareV2ClientApi.institutionsApi.api
>;

export const selfcareV2InstitutionClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InstitutionClient =>
  selfcareV2ClientApi.createInstitutionsApiClient(config.selfcareBaseUrl, {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": config.selfcareApiKey,
      },
    },
  });

export type SelfcareV2ProductClient = ZodiosInstance<
  typeof selfcareV2ClientApi.productApi.api
>;

export const selfcareV2ProductClientBuilder = (
  config: SelfCareConfig
): SelfcareV2ProductClient =>
  selfcareV2ClientApi.createProductApiClient(config.selfcareBaseUrl, {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": config.selfcareApiKey,
      },
    },
  });

export type SelfcareV2DelegationClient = ZodiosInstance<
  typeof selfcareV2ClientApi.DelegationApi.api
>;

export const selfcareV2DelegationClientBuilder = (
  config: SelfCareConfig
): SelfcareV2DelegationClient =>
  selfcareV2ClientApi.createDelegationApiClient(config.selfcareBaseUrl, {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": config.selfcareApiKey,
      },
    },
  });

export type SelfcareV2InterceptorClient = ZodiosInstance<
  typeof selfcareV2ClientApi.interceptorApi.api
>;

export const selfcareV2InterceptorClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InterceptorClient =>
  selfcareV2ClientApi.createInterceptorApiClient(config.selfcareBaseUrl, {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": config.selfcareApiKey,
      },
    },
  });

export type SelfcareV2UsersClient = ZodiosInstance<
  typeof selfcareV2ClientApi.usersApi.api
>;

export const selfcareV2UsersClientBuilder = (
  config: SelfCareConfig
): SelfcareV2UsersClient =>
  selfcareV2ClientApi.createUsersApiClient(config.selfcareBaseUrl, {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": config.selfcareApiKey,
      },
    },
  });
