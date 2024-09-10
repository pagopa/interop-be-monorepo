import { config } from "../config/config.js";

export const ONE_STRUST_API_ENDPOINT = "https://app-de.onetrust.com/api";
export const ONE_TRUST_NOTICES = [
  {
    name: "Terms of service",
    type: "tos",
    id: config.PRIVACY_NOTICES_UPDATER_TERMS_OF_SERVICE_UUID,
  },
  {
    name: "Privacy policy",
    type: "pp",
    id: config.PRIVACY_NOTICES_UPDATER_PRIVACY_POLICY_UUID,
  },
] as const;
