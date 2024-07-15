import { agreementApi } from "pagopa-interop-api-clients";

export const agreementApiState: {
  [key: string]: agreementApi.AgreementState;
} = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  PENDING: "PENDING",
  SUSPENDED: "SUSPENDED",
  MISSING_CERTIFIED_ATTRIBUTES: "MISSING_CERTIFIED_ATTRIBUTES",
  REJECTED: "REJECTED",
} as const;
