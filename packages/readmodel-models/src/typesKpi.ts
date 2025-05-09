import { InferSelectModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  agreement_attributeInReadmodel_agreement,
  agreement_consumer_documentInReadmodel_agreement,
  agreement_contractInReadmodel_agreement,
  agreementInReadmodel_agreement,
  agreement_stampInReadmodel_agreement,
  attributeInReadmodel_attribute,
  clientInReadmodel_client,
  client_jwk_keyInReadmodel_client_jwk_key,
  client_keyInReadmodel_client,
  client_purposeInReadmodel_client,
  client_userInReadmodel_client,
  delegation_contract_documentInReadmodel_delegation,
  delegationInReadmodel_delegation,
  delegation_stampInReadmodel_delegation,
  eservice_descriptor_attributeInReadmodel_catalog,
  eservice_descriptor_documentInReadmodel_catalog,
  eservice_descriptorInReadmodel_catalog,
  eservice_descriptor_interfaceInReadmodel_catalog,
  eservice_descriptor_rejection_reasonInReadmodel_catalog,
  eservice_descriptor_template_version_refInReadmodel_catalog,
  eserviceInReadmodel_catalog,
  eservice_risk_analysis_answerInReadmodel_catalog,
  eservice_risk_analysisInReadmodel_catalog,
  eservice_templateInReadmodel_eservice_template,
  eservice_template_risk_analysis_answerInReadmodel_eservice_template,
  eservice_template_risk_analysisInReadmodel_eservice_template,
  eservice_template_version_attributeInReadmodel_eservice_template,
  eservice_template_version_documentInReadmodel_eservice_template,
  eservice_template_versionInReadmodel_eservice_template,
  eservice_template_version_interfaceInReadmodel_eservice_template,
  producer_jwk_keyInReadmodel_producer_jwk_key,
  producer_keychain_eserviceInReadmodel_producer_keychain,
  producer_keychainInReadmodel_producer_keychain,
  producer_keychain_keyInReadmodel_producer_keychain,
  producer_keychain_userInReadmodel_producer_keychain,
  purposeInReadmodel_purpose,
  purpose_risk_analysis_answerInReadmodel_purpose,
  purpose_risk_analysis_formInReadmodel_purpose,
  purpose_version_documentInReadmodel_purpose,
  purpose_versionInReadmodel_purpose,
  tenant_certified_attributeInReadmodel_tenant,
  tenant_declared_attributeInReadmodel_tenant,
  tenant_featureInReadmodel_tenant,
  tenantInReadmodel_tenant,
  tenant_mailInReadmodel_tenant,
  tenant_verified_attributeInReadmodel_tenant,
  tenant_verified_attribute_revokerInReadmodel_tenant,
  tenant_verified_attribute_verifierInReadmodel_tenant,
} from "./kpi/schema.js";

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type DrizzleTransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

export type EServiceKPI = InferSelectModel<typeof eserviceInReadmodel_catalog>;
export type EServiceDescriptorKPI = InferSelectModel<
  typeof eservice_descriptorInReadmodel_catalog
>;
export type EServiceDescriptorRejectionReasonKPI = InferSelectModel<
  typeof eservice_descriptor_rejection_reasonInReadmodel_catalog
>;
export type EServiceDescriptorInterfaceKPI = InferSelectModel<
  typeof eservice_descriptor_interfaceInReadmodel_catalog
>;
export type EServiceDescriptorDocumentKPI = InferSelectModel<
  typeof eservice_descriptor_documentInReadmodel_catalog
>;
export type EServiceRiskAnalysisKPI = InferSelectModel<
  typeof eservice_risk_analysisInReadmodel_catalog
>;
export type EServiceRiskAnalysisAnswerKPI = InferSelectModel<
  typeof eservice_risk_analysis_answerInReadmodel_catalog
>;
export type EServiceDescriptorAttributeKPI = InferSelectModel<
  typeof eservice_descriptor_attributeInReadmodel_catalog
>;
export type EServiceDescriptorTemplateVersionRefKPI = InferSelectModel<
  typeof eservice_descriptor_template_version_refInReadmodel_catalog
>;
export type EServiceItemsKPI = {
  eserviceKPI: EServiceKPI;
  riskAnalysesKPI: EServiceRiskAnalysisKPI[];
  riskAnalysisAnswersKPI: EServiceRiskAnalysisAnswerKPI[];
  descriptorsKPI: EServiceDescriptorKPI[];
  attributesKPI: EServiceDescriptorAttributeKPI[];
  interfacesKPI: EServiceDescriptorInterfaceKPI[];
  documentsKPI: EServiceDescriptorDocumentKPI[];
  rejectionReasonsKPI: EServiceDescriptorRejectionReasonKPI[];
  templateVersionRefsKPI: EServiceDescriptorTemplateVersionRefKPI[];
};

export type EServiceTemplateKPI = InferSelectModel<
  typeof eservice_templateInReadmodel_eservice_template
>;
export type EServiceTemplateVersionKPI = InferSelectModel<
  typeof eservice_template_versionInReadmodel_eservice_template
>;
export type EServiceTemplateVersionInterfaceKPI = InferSelectModel<
  typeof eservice_template_version_interfaceInReadmodel_eservice_template
>;
export type EServiceTemplateVersionDocumentKPI = InferSelectModel<
  typeof eservice_template_version_documentInReadmodel_eservice_template
>;
export type EServiceTemplateRiskAnalysisKPI = InferSelectModel<
  typeof eservice_template_risk_analysisInReadmodel_eservice_template
>;
export type EServiceTemplateRiskAnalysisAnswerKPI = InferSelectModel<
  typeof eservice_template_risk_analysis_answerInReadmodel_eservice_template
>;
export type EServiceTemplateVersionAttributeKPI = InferSelectModel<
  typeof eservice_template_version_attributeInReadmodel_eservice_template
>;
export type EServiceTemplateItemsKPI = {
  eserviceTemplateKPI: EServiceTemplateKPI;
  riskAnalysesKPI: EServiceTemplateRiskAnalysisKPI[];
  riskAnalysisAnswersKPI: EServiceTemplateRiskAnalysisAnswerKPI[];
  versionsKPI: EServiceTemplateVersionKPI[];
  attributesKPI: EServiceTemplateVersionAttributeKPI[];
  interfacesKPI: EServiceTemplateVersionInterfaceKPI[];
  documentsKPI: EServiceTemplateVersionDocumentKPI[];
};

export type AttributeKPI = InferSelectModel<
  typeof attributeInReadmodel_attribute
>;

export type AgreementAttributeKPI = InferSelectModel<
  typeof agreement_attributeInReadmodel_agreement
>;
export type AgreementConsumerDocumentKPI = InferSelectModel<
  typeof agreement_consumer_documentInReadmodel_agreement
>;
export type AgreementContractKPI = InferSelectModel<
  typeof agreement_contractInReadmodel_agreement
>;
export type AgreementStampKPI = InferSelectModel<
  typeof agreement_stampInReadmodel_agreement
>;
export type AgreementKPI = InferSelectModel<
  typeof agreementInReadmodel_agreement
>;
export type AgreementItemsKPI = {
  agreementKPI: AgreementKPI;
  stampsKPI: AgreementStampKPI[];
  attributesKPI: AgreementAttributeKPI[];
  consumerDocumentsKPI: AgreementConsumerDocumentKPI[];
  contractKPI: AgreementContractKPI | undefined;
};

export type TenantKPI = InferSelectModel<typeof tenantInReadmodel_tenant>;
export type TenantMailKPI = InferSelectModel<
  typeof tenant_mailInReadmodel_tenant
>;
export type TenantCertifiedAttributeKPI = InferSelectModel<
  typeof tenant_certified_attributeInReadmodel_tenant
>;
export type TenantDeclaredAttributeKPI = InferSelectModel<
  typeof tenant_declared_attributeInReadmodel_tenant
>;
export type TenantVerifiedAttributeKPI = InferSelectModel<
  typeof tenant_verified_attributeInReadmodel_tenant
>;
export type TenantVerifiedAttributeVerifierKPI = InferSelectModel<
  typeof tenant_verified_attribute_verifierInReadmodel_tenant
>;
export type TenantVerifiedAttributeRevokerKPI = InferSelectModel<
  typeof tenant_verified_attribute_revokerInReadmodel_tenant
>;
export type TenantFeatureKPI = InferSelectModel<
  typeof tenant_featureInReadmodel_tenant
>;
export type TenantItemsKPI = {
  tenantKPI: TenantKPI;
  mailsKPI: TenantMailKPI[];
  certifiedAttributesKPI: TenantCertifiedAttributeKPI[];
  declaredAttributesKPI: TenantDeclaredAttributeKPI[];
  verifiedAttributesKPI: TenantVerifiedAttributeKPI[];
  verifiedAttributeVerifiersKPI: TenantVerifiedAttributeVerifierKPI[];
  verifiedAttributeRevokersKPI: TenantVerifiedAttributeRevokerKPI[];
  featuresKPI: TenantFeatureKPI[];
};

export type PurposeKPI = InferSelectModel<typeof purposeInReadmodel_purpose>;
export type PurposeVersionKPI = InferSelectModel<
  typeof purpose_versionInReadmodel_purpose
>;
export type PurposeVersionDocumentKPI = InferSelectModel<
  typeof purpose_version_documentInReadmodel_purpose
>;
export type PurposeRiskAnalysisFormKPI = InferSelectModel<
  typeof purpose_risk_analysis_formInReadmodel_purpose
>;
export type PurposeRiskAnalysisAnswerKPI = InferSelectModel<
  typeof purpose_risk_analysis_answerInReadmodel_purpose
>;
export type PurposeItemsKPI = {
  purposeKPI: PurposeKPI;
  riskAnalysisFormKPI: PurposeRiskAnalysisFormKPI | undefined;
  riskAnalysisAnswersKPI: PurposeRiskAnalysisAnswerKPI[] | undefined;
  versionsKPI: PurposeVersionKPI[];
  versionDocumentsKPI: PurposeVersionDocumentKPI[];
};

export type ClientKPI = InferSelectModel<typeof clientInReadmodel_client>;
export type ClientUserKPI = InferSelectModel<
  typeof client_userInReadmodel_client
>;
export type ClientPurposeKPI = InferSelectModel<
  typeof client_purposeInReadmodel_client
>;
export type ClientKeyKPI = InferSelectModel<
  typeof client_keyInReadmodel_client
>;

export type ClientItemsKPI = {
  clientKPI: ClientKPI;
  usersKPI: ClientUserKPI[];
  purposesKPI: ClientPurposeKPI[];
  keysKPI: ClientKeyKPI[];
};

export type ProducerKeychainKPI = InferSelectModel<
  typeof producer_keychainInReadmodel_producer_keychain
>;
export type ProducerKeychainUserKPI = InferSelectModel<
  typeof producer_keychain_userInReadmodel_producer_keychain
>;
export type ProducerKeychainEServiceKPI = InferSelectModel<
  typeof producer_keychain_eserviceInReadmodel_producer_keychain
>;
export type ProducerKeychainKeyKPI = InferSelectModel<
  typeof producer_keychain_keyInReadmodel_producer_keychain
>;
export type ProducerKeychainItemsKPI = {
  producerKeychainKPI: ProducerKeychainKPI;
  usersKPI: ProducerKeychainUserKPI[];
  eservicesKPI: ProducerKeychainEServiceKPI[];
  keysKPI: ProducerKeychainKeyKPI[];
};

export type ClientJWKKeyKPI = InferSelectModel<
  typeof client_jwk_keyInReadmodel_client_jwk_key
>;

export type ProducerJWKKeyKPI = InferSelectModel<
  typeof producer_jwk_keyInReadmodel_producer_jwk_key
>;

export type DelegationKPI = InferSelectModel<
  typeof delegationInReadmodel_delegation
>;
export type DelegationStampKPI = InferSelectModel<
  typeof delegation_stampInReadmodel_delegation
>;
export type DelegationContractDocumentKPI = InferSelectModel<
  typeof delegation_contract_documentInReadmodel_delegation
>;
export type DelegationItemsKPI = {
  delegationKPI: DelegationKPI;
  stampsKPI: DelegationStampKPI[];
  contractDocumentsKPI: DelegationContractDocumentKPI[];
};
