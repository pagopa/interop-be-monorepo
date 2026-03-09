import {
  AgreementDbTableConfig,
  AttributeDbTableConfig,
  CatalogDbTableConfig,
  ClientDbTableConfig,
  ProducerKeychainDbTableConfig,
  DelegationDbTableConfig,
  EserviceTemplateDbTableConfig,
  PurposeDbTableConfig,
} from "pagopa-interop-kpi-models";
import { TenantDbTableConfig } from "./tenant.js";
import { PurposeTemplateDbTableConfig } from "./purposeTemplate.js";

export const DomainDbTable = {
  ...AttributeDbTableConfig,
  ...CatalogDbTableConfig,
  ...AgreementDbTableConfig,
  ...PurposeDbTableConfig,
  ...DelegationDbTableConfig,
  ...TenantDbTableConfig,
  ...ClientDbTableConfig,
  ...ProducerKeychainDbTableConfig,
  ...EserviceTemplateDbTableConfig,
  ...PurposeTemplateDbTableConfig,
} as const;
export type DomainDbTableSchemas = typeof DomainDbTable;
export type DomainDbTable = keyof DomainDbTableSchemas;
