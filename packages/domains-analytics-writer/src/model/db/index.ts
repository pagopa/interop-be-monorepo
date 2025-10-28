import {
  AgreementDbTableConfig,
  AgreementDbTableReadModel,
} from "./agreement.js";
import {
  AttributeDbTableConfig,
  AttributeDbTableReadModel,
} from "./attribute.js";
import {
  CatalogDbPartialTableConfig,
  CatalogDbPartialTableReadModel,
  CatalogDbTableConfig,
  CatalogDbTableReadModel,
} from "./catalog.js";
import {
  ClientDbTableConfig,
  ClientDbTableReadModel,
  ProducerKeychainDbTableConfig,
  ProducerKeychainDbTableReadModel,
  ClientDbTablePartialTableConfig,
  ClientDbTablePartialTableReadModel,
} from "./authorization.js";
import {
  DelegationDbTableConfig,
  DelegationDbTableReadModel,
} from "./delegation.js";
import { PurposeDbTableConfig, PurposeDbTableReadModel } from "./purpose.js";
import { DeletingDbTableConfig, DeletingDbTableReadModel } from "./deleting.js";
import {
  EserviceTemplateDbTableConfig,
  EserviceTemplateDbTableReadModel,
} from "./eserviceTemplate.js";
import {
  TenantDbPartialTableConfig,
  TenantDbTableConfig,
  TenantDbTableReadModel,
  TenantDbPartialTableReadModel,
} from "./tenant.js";
import {
  PurposeTemplateDbTableConfig,
  PurposeTemplateDbTableReadModel,
} from "./purposeTemplate.js";

export const PartialDbTable = {
  ...TenantDbPartialTableConfig,
  ...CatalogDbPartialTableConfig,
  ...ClientDbTablePartialTableConfig,
} as const;
export type PartialDbTableSchemas = typeof PartialDbTable;
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
export type DbTableSchemas = typeof DbTable;
export type DbTable = keyof DbTableSchemas;

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

export const PartialDbTableReadModels = {
  ...TenantDbPartialTableReadModel,
  ...CatalogDbPartialTableReadModel,
  ...ClientDbTablePartialTableReadModel,
} as const;
export type PartialDbTableReadModels = typeof PartialDbTableReadModels;

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
