import { InferSelectModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
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
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
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

export type DrizzleReturnType = ReturnType<typeof drizzle>;
export type DrizzleTransactionType = Parameters<
  Parameters<DrizzleReturnType["transaction"]>[0]
>[0];

export type EServiceSQL = InferSelectModel<typeof eserviceInReadmodelCatalog>;
export type EServiceDescriptorSQL = InferSelectModel<
  typeof eserviceDescriptorInReadmodelCatalog
>;
export type EServiceDescriptorRejectionReasonSQL = InferSelectModel<
  typeof eserviceDescriptorRejectionReasonInReadmodelCatalog
>;
export type EServiceDescriptorInterfaceSQL = InferSelectModel<
  typeof eserviceDescriptorInterfaceInReadmodelCatalog
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
export type EServiceDescriptorTemplateVersionRefSQL = InferSelectModel<
  typeof eserviceDescriptorTemplateVersionRefInReadmodelCatalog
>;
export type EServiceItemsSQL = {
  eserviceSQL: EServiceSQL;
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  interfacesSQL: EServiceDescriptorInterfaceSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[];
};

export type EServiceTemplateSQL = InferSelectModel<
  typeof eserviceTemplateInReadmodelEserviceTemplate
>;
export type EServiceTemplateVersionSQL = InferSelectModel<
  typeof eserviceTemplateVersionInReadmodelEserviceTemplate
>;
export type EServiceTemplateVersionInterfaceSQL = InferSelectModel<
  typeof eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate
>;
export type EServiceTemplateVersionDocumentSQL = InferSelectModel<
  typeof eserviceTemplateVersionDocumentInReadmodelEserviceTemplate
>;
export type EServiceTemplateRiskAnalysisSQL = InferSelectModel<
  typeof eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate
>;
export type EServiceTemplateRiskAnalysisAnswerSQL = InferSelectModel<
  typeof eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate
>;
export type EServiceTemplateVersionAttributeSQL = InferSelectModel<
  typeof eserviceTemplateVersionAttributeInReadmodelEserviceTemplate
>;
export type EServiceTemplateItemsSQL = {
  eserviceTemplateSQL: EServiceTemplateSQL;
  riskAnalysesSQL: EServiceTemplateRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[];
  versionsSQL: EServiceTemplateVersionSQL[];
  attributesSQL: EServiceTemplateVersionAttributeSQL[];
  interfacesSQL: EServiceTemplateVersionInterfaceSQL[];
  documentsSQL: EServiceTemplateVersionDocumentSQL[];
};

export type AttributeSQL = InferSelectModel<
  typeof attributeInReadmodelAttribute
>;

export type AgreementAttributeSQL = InferSelectModel<
  typeof agreementAttributeInReadmodelAgreement
>;
export type AgreementConsumerDocumentSQL = InferSelectModel<
  typeof agreementConsumerDocumentInReadmodelAgreement
>;
export type AgreementContractSQL = InferSelectModel<
  typeof agreementContractInReadmodelAgreement
>;
export type AgreementStampSQL = InferSelectModel<
  typeof agreementStampInReadmodelAgreement
>;
export type AgreementSQL = InferSelectModel<
  typeof agreementInReadmodelAgreement
>;
export type AgreementItemsSQL = {
  agreementSQL: AgreementSQL;
  stampsSQL: AgreementStampSQL[];
  attributesSQL: AgreementAttributeSQL[];
  consumerDocumentsSQL: AgreementConsumerDocumentSQL[];
  contractSQL: AgreementContractSQL | undefined;
};

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
export type TenantItemsSQL = {
  tenantSQL: TenantSQL;
  mailsSQL: TenantMailSQL[];
  certifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  declaredAttributesSQL: TenantDeclaredAttributeSQL[];
  verifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  verifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  verifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  featuresSQL: TenantFeatureSQL[];
};

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
export type PurposeItemsSQL = {
  purposeSQL: PurposeSQL;
  riskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined;
  riskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] | undefined;
  versionsSQL: PurposeVersionSQL[];
  versionDocumentsSQL: PurposeVersionDocumentSQL[];
};

export type ClientSQL = InferSelectModel<typeof clientInReadmodelClient>;
export type ClientUserSQL = InferSelectModel<
  typeof clientUserInReadmodelClient
>;
export type ClientPurposeSQL = InferSelectModel<
  typeof clientPurposeInReadmodelClient
>;
export type ClientKeySQL = InferSelectModel<typeof clientKeyInReadmodelClient>;

export type ClientItemsSQL = {
  clientSQL: ClientSQL;
  usersSQL: ClientUserSQL[];
  purposesSQL: ClientPurposeSQL[];
  keysSQL: ClientKeySQL[];
};

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
  usersSQL: ProducerKeychainUserSQL[];
  eservicesSQL: ProducerKeychainEServiceSQL[];
  keysSQL: ProducerKeychainKeySQL[];
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
export type DelegationItemsSQL = {
  delegationSQL: DelegationSQL;
  stampsSQL: DelegationStampSQL[];
  contractDocumentsSQL: DelegationContractDocumentSQL[];
};
