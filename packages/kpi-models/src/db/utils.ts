import { AgreementDbTableReadModel } from "./agreement.js";
import { AttributeDbTableReadModel } from "./attribute.js";
import { CatalogDbTableReadModel } from "./catalog.js";
import {
  ClientDbTableReadModel,
  ProducerKeychainDbTableReadModel,
} from "./authorization.js";
import { DelegationDbTableReadModel } from "./delegation.js";
import { PurposeDbTableReadModel } from "./purpose.js";
import { EserviceTemplateDbTableReadModel } from "./eserviceTemplate.js";
import { TenantDbTableReadModel } from "./tenant.js";
import { PurposeTemplateDbTableReadModel } from "./purposeTemplate.js";

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
