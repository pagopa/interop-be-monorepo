import { isErrorFromAlias } from "@zodios/core";
import { config } from "./utilities/config/config.js";
import { createApiClient } from "./model/generated/api.js";

export const selfcareV2Client = createApiClient(config.selfcare_baseUrl, {
  axiosConfig: {
    headers: {
      "Ocp-Apim-Subscription-Key": config.selfcare_apiKey,
    },
  },
});
export type SelfcareV2Client = typeof selfcareV2Client;

const api = selfcareV2Client.api;

export function mapInstitutionError(error: unknown): 400 | 404 | undefined {
  if (isErrorFromAlias(api, "getInstitution", error)) {
    return error.response.status;
  }
  return undefined;
}
