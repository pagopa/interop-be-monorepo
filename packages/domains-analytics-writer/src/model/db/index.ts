import { AgreementDbTableConfig } from "./agreement.js";
import { AttributeDbTableConfig } from "./attribute.js";
import {
  CatalogDbPartialTableConfig,
  CatalogDbPartialTableReadModel,
  CatalogDbTableConfig,
} from "./catalog.js";
import {
  ClientDbTableConfig,
  ProducerKeychainDbTableConfig,
  ClientDbTablePartialTableConfig,
  ClientDbTablePartialTableReadModel,
} from "./authorization.js";
import { DelegationDbTableConfig } from "./delegation.js";
import { PurposeDbTableConfig } from "./purpose.js";
import { DeletingDbTableConfig, DeletingDbTableReadModel } from "./deleting.js";
import { EserviceTemplateDbTableConfig } from "./eserviceTemplate.js";
import {
  TenantDbPartialTableConfig,
  TenantDbTableConfig,
  TenantDbPartialTableReadModel,
} from "./tenant.js";
import { PurposeTemplateDbTableConfig } from "./purposeTemplate.js";
import { DomainDbTableReadModels } from "pagopa-interop-kpi-models";

export const PartialDbTable = {
  ...TenantDbPartialTableConfig,
  ...CatalogDbPartialTableConfig,
  ...ClientDbTablePartialTableConfig,
} as const;
type PartialDbTableSchemas = typeof PartialDbTable;
export type PartialDbTable = keyof PartialDbTableSchemas;

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

export const DbTable = {
  ...DomainDbTable,
  ...PartialDbTable,
  ...DeletingDbTableConfig,
} as const;
type DbTableSchemas = typeof DbTable;
export type DbTable = keyof DbTableSchemas;

const PartialDbTableReadModels = {
  ...TenantDbPartialTableReadModel,
  ...CatalogDbPartialTableReadModel,
  ...ClientDbTablePartialTableReadModel,
} as const;
type PartialDbTableReadModels = typeof PartialDbTableReadModels;

export const DbTableReadModels = {
  ...DomainDbTableReadModels,
  ...PartialDbTableReadModels,
  ...DeletingDbTableReadModel,
} as const;
export type DbTableReadModels = typeof DbTableReadModels;

export * from "./attribute.js";
export * from "./catalog.js";
export * from "./agreement.js";
export * from "./authorization.js";
export * from "./purpose.js";
export * from "./delegation.js";
export * from "./tenant.js";
export * from "./deleting.js";
export * from "./eserviceTemplate.js";
export * from "./purposeTemplate.js";
