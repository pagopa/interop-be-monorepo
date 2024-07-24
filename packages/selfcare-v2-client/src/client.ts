import { ZodiosInstance } from "@zodios/core";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { SelfCareConfig } from "./config/selfcareConfig.js";
import { createApiClient, api } from "./model/generated/api.js";

export type SelfcareV2Client = ZodiosInstance<typeof api.api>;

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

export const selfcareV2ClientBuilder = (
  config: SelfCareConfig
): SelfcareV2Client =>
  createApiClient(config.selfcareBaseUrl, {
    axiosInstance: createAxiosInstance(config.selfcareApiKey) as never,
  });
