import {
  AgreementDbTableConfig,
  AgreementDbTableReadModel,
} from "./agreement.js";
import {
  AttributeDbTableConfig,
  AttributeDbTableReadModel,
} from "./attribute.js";
import { CatalogDbTableConfig, CatalogDbTableReadModel } from "./catalog.js";
import {
  ClientDbTableConfig,
  ClientDbTableReadModel,
  ProducerKeychainDbTableConfig,
  ProducerKeychainDbTableReadModel,
} from "./authorization.js";
import {
  DelegationDbTableConfig,
  DelegationDbTableReadModel,
} from "./delegation.js";
import { PurposeDbTableConfig, PurposeDbTableReadModel } from "./purpose.js";
import {
  EserviceTemplateDbTableConfig,
  EserviceTemplateDbTableReadModel,
} from "./eserviceTemplate.js";
import { TenantDbTableConfig, TenantDbTableReadModel } from "./tenant.js";
import {
  PurposeTemplateDbTableConfig,
  PurposeTemplateDbTableReadModel,
} from "./purposeTemplate.js";

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

export const DomainDbTableReadModels = {
  ...AttributeDbTableReadModel,
  ...CatalogDbTableReadModel,
  ...AgreementDbTableReadModel,
  ...DelegationDbTableReadModel,
  ...PurposeDbTableReadModel,
  ...TenantDbTableReadModel,
  ...ClientDbTableReadModel,
  ...ProducerKeychainDbTableReadModel,
  ...EserviceTemplateDbTableReadModel,
  ...PurposeTemplateDbTableReadModel,
} as const;
export type DomainDbTableReadModels = typeof DomainDbTableReadModels;
