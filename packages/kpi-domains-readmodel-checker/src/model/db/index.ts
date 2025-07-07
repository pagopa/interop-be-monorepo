import { AgreementDbTableConfig } from "./agreement.js";
import { AttributeDbTableConfig } from "./attribute.js";
import { CatalogDbTableConfig } from "./catalog.js";
import {
  ClientDbTableConfig,
  ProducerKeychainDbTableConfig,
} from "./authorization.js";
import { DelegationDbTableConfig } from "./delegation.js";
import { PurposeDbTableConfig } from "./purpose.js";
import { EserviceTemplateDbTableConfig } from "./eserviceTemplate.js";
import { TenantDbTableConfig } from "./tenant.js";

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
} as const;
export type DomainDbTableSchemas = typeof DomainDbTable;
export type DomainDbTable = keyof DomainDbTableSchemas;
