import { z } from "zod";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  eserviceInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  purposeInReadmodelPurpose,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientKeyInReadmodelClient,
  producerKeychainInReadmodelProducerKeychain,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
} from "pagopa-interop-readmodel-models";

import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";
import { EserviceTemplateDeletingSchema } from "../eserviceTemplate/eserviceTemplate.js";
import { TenantDeletingSchema } from "../tenant/tenant.js";
import { TenantMailDeletingSchema } from "../tenant/tenantMail.js";
import { AgreementDeletingSchema } from "../agreement/agreement.js";
import { ClientDeletingSchema } from "../authorization/client.js";
import { ClientUserDeletingSchema } from "../authorization/clientUser.js";
import { ClientPurposeDeletingSchema } from "../authorization/clientPurpose.js";
import { ClientKeyDeletingSchema } from "../authorization/clientKey.js";
import { PurposeDeletingSchema } from "../purpose/purpose.js";
import { EserviceDescriptorDocumentOrInterfaceDeletingSchema } from "../catalog/eserviceDescriptorInterface.js";
import { ProducerKeychainDeletingSchema } from "../authorization/producerKeychain.js";
import { PurposeTemplateDeletingSchema } from "../purposeTemplate/purposeTemplate.js";
import { PurposeTemplateEServiceDescriptorDeletingSchema } from "../purposeTemplate/purposeTemplateEserviceDescriptor.js";

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_descriptor_interface_deleting_table:
    EserviceDescriptorDocumentOrInterfaceDeletingSchema,
  agreement_deleting_table: AgreementDeletingSchema,
  purpose_deleting_table: PurposeDeletingSchema,
  tenant_deleting_table: TenantDeletingSchema,
  tenant_mail_deleting_table: TenantMailDeletingSchema,
  client_deleting_table: ClientDeletingSchema,
  client_user_deleting_table: ClientUserDeletingSchema,
  client_purpose_deleting_table: ClientPurposeDeletingSchema,
  client_key_deleting_table: ClientKeyDeletingSchema,
  producer_keychain_deleting_table: ProducerKeychainDeletingSchema,
  eservice_template_deleting_table: EserviceTemplateDeletingSchema,
  purpose_template_deleting_table: PurposeTemplateDeletingSchema,
  purpose_template_eservice_descriptor_deleting_table:
    PurposeTemplateEServiceDescriptorDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = {
  attribute_deleting_table: attributeInReadmodelAttribute,
  catalog_deleting_table: eserviceInReadmodelCatalog,
  catalog_descriptor_interface_deleting_table:
    eserviceDescriptorInterfaceInReadmodelCatalog,
  agreement_deleting_table: agreementInReadmodelAgreement,
  purpose_deleting_table: purposeInReadmodelPurpose,
  tenant_deleting_table: tenantInReadmodelTenant,
  tenant_mail_deleting_table: tenantMailInReadmodelTenant,
  client_deleting_table: clientInReadmodelClient,
  client_user_deleting_table: clientUserInReadmodelClient,
  client_purpose_deleting_table: clientPurposeInReadmodelClient,
  client_key_deleting_table: clientKeyInReadmodelClient,
  producer_keychain_deleting_table: producerKeychainInReadmodelProducerKeychain,
  eservice_template_deleting_table: eserviceTemplateInReadmodelEserviceTemplate,
  purpose_template_deleting_table: purposeTemplateInReadmodelPurposeTemplate,
  purpose_template_eservice_descriptor_deleting_table:
    purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
} as const;
export type DeletingDbTableReadModel = typeof DeletingDbTableReadModel;

export type DeletingDbTable = keyof DeletingDbTableConfig;

export const DeletingDbTable = Object.fromEntries(
  Object.keys(DeletingDbTableConfig).map((k) => [k, k])
) as { [K in DeletingDbTable]: K };

export type DeletingDbTableConfigMap = {
  [K in keyof DeletingDbTableConfig]: {
    name: K;
    columns: ReadonlyArray<keyof z.infer<DeletingDbTableConfig[K]>>;
  };
}[keyof DeletingDbTableConfig];
