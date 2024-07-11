import { catalogApi } from "pagopa-interop-api-clients";

export type CatalogProcessClientApi = typeof catalogApi.processApi.api;

export const descriptorApiState: {
  [key: string]: catalogApi.EServiceDescriptorState;
} = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  DEPRECATED: "DEPRECATED",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;

export const agreementApiState: {
  [key: string]: catalogApi.AgreementApprovalPolicy;
} = {
  MANUAL: "MANUAL",
  AUTOMATIC: "AUTOMATIC",
} as const;
