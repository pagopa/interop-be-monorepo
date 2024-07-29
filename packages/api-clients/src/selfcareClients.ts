import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { ZodiosInstance, ZodiosOptions } from "@zodios/core";
import * as AxiosLogger from "axios-logger";
import { z } from "zod";
import { SelfCareConfig } from "pagopa-interop-commons";
import { selfcareV2ClientApi } from "./index.js";

const createClientConfig = (selfcareApiKey: string): ZodiosOptions => ({
  axiosConfig: {
    headers: {
      "Ocp-Apim-Subscription-Key": selfcareApiKey,
    },
  },
});

const configureInterceptors = (client: AxiosInstance): void => {
  client.interceptors.request.use((request) => {
    AxiosLogger.requestLogger(request as never, { params: true });
    return request;
  });

  client.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => response,
    (error: AxiosError): Promise<AxiosError> => {
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
};

export type SelfcareV2InstitutionClient = ZodiosInstance<
  typeof selfcareV2ClientApi.institutionsApi.api
>;

export const selfcareV2InstitutionClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InstitutionClient => {
  const client = selfcareV2ClientApi.createInstitutionsApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
  configureInterceptors(client.axios as never);
  return client;
};

export type SelfcareV2ProductClient = ZodiosInstance<
  typeof selfcareV2ClientApi.productApi.api
>;

export const selfcareV2ProductClientBuilder = (
  config: SelfCareConfig
): SelfcareV2ProductClient => {
  const client = selfcareV2ClientApi.createProductApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
  configureInterceptors(client.axios as never);
  return client;
};

export type SelfcareV2DelegationClient = ZodiosInstance<
  typeof selfcareV2ClientApi.DelegationApi.api
>;

export const selfcareV2DelegationClientBuilder = (
  config: SelfCareConfig
): SelfcareV2DelegationClient => {
  const client = selfcareV2ClientApi.createDelegationApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
  configureInterceptors(client.axios as never);
  return client;
};

export type SelfcareV2InterceptorClient = ZodiosInstance<
  typeof selfcareV2ClientApi.interceptorApi.api
>;

export const selfcareV2InterceptorClientBuilder = (
  config: SelfCareConfig
): SelfcareV2InterceptorClient => {
  const client = selfcareV2ClientApi.createInterceptorApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
  configureInterceptors(client.axios as never);
  return client;
};

export type SelfcareV2UsersClient = ZodiosInstance<
  typeof selfcareV2ClientApi.usersApi.api
>;

export const selfcareV2UsersClientBuilder = (
  config: SelfCareConfig
): SelfcareV2UsersClient => {
  const client = selfcareV2ClientApi.createUsersApiClient(
    config.selfcareBaseUrl,
    createClientConfig(config.selfcareApiKey)
  );
  configureInterceptors(client.axios as never);
  return client;
};
