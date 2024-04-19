import { config } from "./utilities/config/config.js";
import { createApiClient } from "./model/generated/api.js";

export const selfcareV2Client = createApiClient(config.selfcare_baseUrl, {
  axiosConfig: {
    headers: {
      "Ocp-Apim-Subscription-Key": config.selfcare_apiKey,
    },
  },
});
