import { ZodiosInstance } from "@zodios/core";
import { api, createApiClient } from "./model/generated/api.js";
import { SelfCareConfig } from "./utilities/config/config.js";

export type SelfcareV2Client = ZodiosInstance<typeof api.api>;

export const selfcareV2ClientBuilder = (
  config: SelfCareConfig
): SelfcareV2Client =>
  createApiClient(config.selfcareBaseUrl, {
    axiosConfig: {
      headers: {
        "Ocp-Apim-Subscription-Key": config.selfcareApiKey,
      },
    },
  });
