import { ZodiosInstance } from "@zodios/core";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { SelfCareConfig } from "pagopa-interop-commons";
import { selfcareV2ClientApi } from "./index.js";

export type SelfcareV2InstitutionClient = ZodiosInstance<
  typeof selfcareV2ClientApi.institutionsApi.api
>;

const createAxiosInstance = (selfcareApiKey: string): AxiosInstance => {
  const instance = axios.create({
    headers: {
      "Ocp-Apim-Subscription-Key": selfcareApiKey,
    },
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      const parsedErrorResponseData = z
        .object({
          statusCode: z.number(),
          message: z.string(),
        })
        .safeParse(error.response?.data);

      if (parsedErrorResponseData.success) {
        const { statusCode, message } = parsedErrorResponseData.data;
        // eslint-disable-next-line functional/immutable-data
        error.message = `${statusCode} - ${message}`;
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export const selfcareV2InstitutionClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InstitutionClient =>
  selfcareV2ClientApi.createInstitutionsApiClient(config.selfcareBaseUrl, {
    axiosInstance: createAxiosInstance(config.selfcareApiKey) as never,
  });

export type SelfcareV2ProductClient = ZodiosInstance<
  typeof selfcareV2ClientApi.productApi.api
>;

export const selfcareV2ProductClientBuilder = (
  config: SelfCareConfig
): SelfcareV2ProductClient =>
  selfcareV2ClientApi.createProductApiClient(config.selfcareBaseUrl, {
    axiosInstance: createAxiosInstance(config.selfcareApiKey) as never,
  });

export type SelfcareV2DelegationClient = ZodiosInstance<
  typeof selfcareV2ClientApi.DelegationApi.api
>;

export const selfcareV2DelegationClientBuilder = (
  config: SelfCareConfig
): SelfcareV2DelegationClient =>
  selfcareV2ClientApi.createDelegationApiClient(config.selfcareBaseUrl, {
    axiosInstance: createAxiosInstance(config.selfcareApiKey) as never,
  });

export type SelfcareV2InterceptorClient = ZodiosInstance<
  typeof selfcareV2ClientApi.interceptorApi.api
>;

export const selfcareV2InterceptorClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InterceptorClient =>
  selfcareV2ClientApi.createInterceptorApiClient(config.selfcareBaseUrl, {
    axiosInstance: createAxiosInstance(config.selfcareApiKey) as never,
  });

export type SelfcareV2UsersClient = ZodiosInstance<
  typeof selfcareV2ClientApi.usersApi.api
>;

export const selfcareV2UsersClientBuilder = (
  config: SelfCareConfig
): SelfcareV2UsersClient =>
  selfcareV2ClientApi.createUsersApiClient(config.selfcareBaseUrl, {
    axiosInstance: createAxiosInstance(config.selfcareApiKey) as never,
  });
