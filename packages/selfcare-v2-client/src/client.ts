import { ZodiosInstance } from "@zodios/core";
import { SelfCareConfig } from "./config/selfcareConfig.js";
import { createApiClient, api } from "./model/generated/api.js";

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
