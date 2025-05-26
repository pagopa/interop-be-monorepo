import {
  AgreementDbTableConfig,
  AgreementDbTableReadModel,
} from "./agreement.js";
import {
  AttributeDbTableConfig,
  AttributeDbTableReadModel,
} from "./attribute.js";
import { CatalogDbTableConfig, CatalogDbTableReadModel } from "./catalog.js";
import { PurposeDbTableConfig, PurposeDbTableReadModel } from "./purpose.js";
import { DeletingDbTableConfig, DeletingDbTableReadModel } from "./deleting.js";

export const DomainDbTable = {
  ...AttributeDbTableConfig,
  ...CatalogDbTableConfig,
  ...AgreementDbTableConfig,
  ...PurposeDbTableConfig,
} as const;
export type DomainDbTableSchemas = typeof DomainDbTable;
export type DomainDbTable = keyof DomainDbTableSchemas;

export const DbTable = {
  ...DomainDbTable,
  ...DeletingDbTableConfig,
} as const;
export type DbTableSchemas = typeof DbTable;
export type DbTable = keyof DbTableSchemas;

export const DomainDbTableReadModels = {
  ...AttributeDbTableReadModel,
  ...CatalogDbTableReadModel,
  ...AgreementDbTableReadModel,
  ...PurposeDbTableReadModel,
} as const;
export type DomainDbTableReadModels = typeof DomainDbTableReadModels;

export const DbTableReadModels = {
  ...DomainDbTableReadModels,
  ...DeletingDbTableReadModel,
} as const;
export type DbTableReadModels = typeof DbTableReadModels;

export * from "./attribute.js";
export * from "./catalog.js";
export * from "./agreement.js";
export * from "./deleting.js";
export * from "./purpose.js";
