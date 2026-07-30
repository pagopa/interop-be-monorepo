import {
  AgreementDbTableConfig,
  AttributeDbTableConfig,
  CatalogDbTableConfig,
  ClientDbTableConfig,
  ProducerKeychainDbTableConfig,
  DelegationDbTableConfig,
  EserviceTemplateDbTableConfig,
  PurposeDbTableConfig,
  PurposeTemplateDbTableConfig,
  TenantDbTableConfig,
} from "pagopa-interop-kpi-models";

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
