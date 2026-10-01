import { AgreementDbTableReadModel } from "./agreement.js";
import { AttributeDbTableReadModel } from "./attribute.js";
import {
  ClientDbTableReadModel,
  ProducerKeychainDbTableReadModel,
} from "./authorization.js";
import { CatalogDbTableReadModel } from "./catalog.js";
import { DelegationDbTableReadModel } from "./delegation.js";
import { EserviceTemplateDbTableReadModel } from "./eserviceTemplate.js";
import { PurposeDbTableReadModel } from "./purpose.js";
import { PurposeTemplateDbTableReadModel } from "./purposeTemplate.js";
import { TenantDbTableReadModel } from "./tenant.js";

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
