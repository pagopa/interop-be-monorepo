import { config } from "../config/config.js";

export const ONE_STRUST_API_ENDPOINT = "https://app-de.onetrust.com/api";
export const ONE_TRUST_NOTICES = [
  {
    name: "Terms of service",
    type: "tos",
    id: config.privacyNoticesUpdaterTermsOfServiceUuid,
  },
  {
    name: "Privacy policy",
    type: "pp",
    id: config.privacyNoticesUpdaterPrivacyPolicyUuid,
  },
] as const;
