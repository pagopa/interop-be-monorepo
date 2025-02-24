import { InferSelectModel } from "drizzle-orm";
import {
  agreementAttributeInReadmodelAgreement,
  agreementDocumentInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  attributeInReadmodelAttribute,
  clientInReadmodelClient,
  clientJwkKeyInReadmodelClientJwkKey,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceTemplateBindingInReadmodelCatalog,
  producerJwkKeyInReadmodelProducerJwkKey,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
} from "./drizzle/schema.js";

export type EServiceSQL = InferSelectModel<typeof eserviceInReadmodelCatalog>;
export type EServiceDescriptorSQL = InferSelectModel<
  typeof eserviceDescriptorInReadmodelCatalog
>;
export type EServiceDescriptorRejectionReasonSQL = InferSelectModel<
  typeof eserviceDescriptorRejectionReasonInReadmodelCatalog
>;
export type EServiceDescriptorDocumentSQL = InferSelectModel<
  typeof eserviceDescriptorDocumentInReadmodelCatalog
>;
export type EServiceRiskAnalysisSQL = InferSelectModel<
  typeof eserviceRiskAnalysisInReadmodelCatalog
>;
export type EServiceRiskAnalysisAnswerSQL = InferSelectModel<
  typeof eserviceRiskAnalysisAnswerInReadmodelCatalog
>;
export type EServiceDescriptorAttributeSQL = InferSelectModel<
  typeof eserviceDescriptorAttributeInReadmodelCatalog
>;
export type EServiceTemplateBindingSQL = InferSelectModel<
  typeof eserviceTemplateBindingInReadmodelCatalog
>;

export type AttributeSQL = InferSelectModel<
  typeof attributeInReadmodelAttribute
>;

export type AgreementAttributeSQL = InferSelectModel<
  typeof agreementAttributeInReadmodelAgreement
>;
export type AgreementDocumentSQL = InferSelectModel<
  typeof agreementDocumentInReadmodelAgreement
>;
export type AgreementStampSQL = InferSelectModel<
  typeof agreementStampInReadmodelAgreement
>;
export type AgreementSQL = InferSelectModel<
  typeof agreementInReadmodelAgreement
>;

export type TenantSQL = InferSelectModel<typeof tenantInReadmodelTenant>;
export type TenantMailSQL = InferSelectModel<
  typeof tenantMailInReadmodelTenant
>;
export type TenantCertifiedAttributeSQL = InferSelectModel<
  typeof tenantCertifiedAttributeInReadmodelTenant
>;
export type TenantDeclaredAttributeSQL = InferSelectModel<
  typeof tenantDeclaredAttributeInReadmodelTenant
>;
export type TenantVerifiedAttributeSQL = InferSelectModel<
  typeof tenantVerifiedAttributeInReadmodelTenant
>;
export type TenantVerifiedAttributeVerifierSQL = InferSelectModel<
  typeof tenantVerifiedAttributeVerifierInReadmodelTenant
>;
export type TenantVerifiedAttributeRevokerSQL = InferSelectModel<
  typeof tenantVerifiedAttributeRevokerInReadmodelTenant
>;
export type TenantFeatureSQL = InferSelectModel<
  typeof tenantFeatureInReadmodelTenant
>;

export type PurposeSQL = InferSelectModel<typeof purposeInReadmodelPurpose>;
export type PurposeVersionSQL = InferSelectModel<
  typeof purposeVersionInReadmodelPurpose
>;
export type PurposeVersionDocumentSQL = InferSelectModel<
  typeof purposeVersionDocumentInReadmodelPurpose
>;
export type PurposeRiskAnalysisFormSQL = InferSelectModel<
  typeof purposeRiskAnalysisFormInReadmodelPurpose
>;
export type PurposeRiskAnalysisAnswerSQL = InferSelectModel<
  typeof purposeRiskAnalysisAnswerInReadmodelPurpose
>;

export type ClientSQL = InferSelectModel<typeof clientInReadmodelClient>;
export type ClientUserSQL = InferSelectModel<
  typeof clientUserInReadmodelClient
>;
export type ClientPurposeSQL = InferSelectModel<
  typeof clientPurposeInReadmodelClient
>;
export type ClientKeySQL = InferSelectModel<typeof clientKeyInReadmodelClient>;

export type ProducerKeychainSQL = InferSelectModel<
  typeof producerKeychainInReadmodelProducerKeychain
>;
export type ProducerKeychainUserSQL = InferSelectModel<
  typeof producerKeychainUserInReadmodelProducerKeychain
>;
export type ProducerKeychainEServiceSQL = InferSelectModel<
  typeof producerKeychainEserviceInReadmodelProducerKeychain
>;
export type ProducerKeychainKeySQL = InferSelectModel<
  typeof producerKeychainKeyInReadmodelProducerKeychain
>;

export type ProducerKeychainItemsSQL = {
  producerKeychainSQL: ProducerKeychainSQL;
  producerKeychainUsersSQL: ProducerKeychainUserSQL[];
  producerKeychainEServicesSQL: ProducerKeychainEServiceSQL[];
  producerKeychainKeysSQL: ProducerKeychainKeySQL[];
};

export type ClientJWKKeySQL = InferSelectModel<
  typeof clientJwkKeyInReadmodelClientJwkKey
>;

export type ProducerJWKKeySQL = InferSelectModel<
  typeof producerJwkKeyInReadmodelProducerJwkKey
>;

export type DelegationSQL = InferSelectModel<
  typeof delegationInReadmodelDelegation
>;
export type DelegationStampSQL = InferSelectModel<
  typeof delegationStampInReadmodelDelegation
>;
export type DelegationContractDocumentSQL = InferSelectModel<
  typeof delegationContractDocumentInReadmodelDelegation
>;
