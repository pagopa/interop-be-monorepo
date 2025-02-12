import { InferSelectModel } from "drizzle-orm";
import {
  eserviceDescriptorAttributeInReadmodel,
  eserviceDescriptorDocumentInReadmodel,
  eserviceDescriptorInReadmodel,
  eserviceDescriptorRejectionReasonInReadmodel,
  eserviceInReadmodel,
  eserviceRiskAnalysisAnswerInReadmodel,
  eserviceRiskAnalysisInReadmodel,
  eserviceTemplateBindingInReadmodel,
  attributeInReadmodel,
  agreementAttributeInReadmodel,
  agreementDocumentInReadmodel,
  agreementInReadmodel,
  agreementStampInReadmodel,
  tenantCertifiedAttributeInReadmodel,
  tenantDeclaredAttributeInReadmodel,
  tenantFeatureInReadmodel,
  tenantInReadmodel,
  tenantMailInReadmodel,
  tenantVerifiedAttributeInReadmodel,
  tenantVerifiedAttributeRevokerInReadmodel,
  tenantVerifiedAttributeVerifierInReadmodel,
  purposeInReadmodel,
  purposeRiskAnalysisAnswerInReadmodel,
  purposeRiskAnalysisFormInReadmodel,
  purposeVersionDocumentInReadmodel,
  purposeVersionInReadmodel,
  clientInReadmodel,
  clientKeyInReadmodel,
  clientPurposeInReadmodel,
  clientUserInReadmodel,
  producerKeychainEserviceInReadmodel,
  producerKeychainInReadmodel,
  producerKeychainKeyInReadmodel,
  producerKeychainUserInReadmodel,
  clientJwkKeyInReadmodel,
} from "./drizzle/schema.js";

export type EServiceSQL = InferSelectModel<typeof eserviceInReadmodel>;
export type EServiceDescriptorSQL = InferSelectModel<
  typeof eserviceDescriptorInReadmodel
>;
export type EServiceDescriptorRejectionReasonSQL = InferSelectModel<
  typeof eserviceDescriptorRejectionReasonInReadmodel
>;
export type EServiceDescriptorDocumentSQL = InferSelectModel<
  typeof eserviceDescriptorDocumentInReadmodel
>;
export type EServiceRiskAnalysisSQL = InferSelectModel<
  typeof eserviceRiskAnalysisInReadmodel
>;
export type EServiceRiskAnalysisAnswerSQL = InferSelectModel<
  typeof eserviceRiskAnalysisAnswerInReadmodel
>;
export type EServiceDescriptorAttributeSQL = InferSelectModel<
  typeof eserviceDescriptorAttributeInReadmodel
>;
export type EServiceTemplateBindingSQL = InferSelectModel<
  typeof eserviceTemplateBindingInReadmodel
>;

export type AttributeSQL = InferSelectModel<typeof attributeInReadmodel>;

export type AgreementAttributeSQL = InferSelectModel<
  typeof agreementAttributeInReadmodel
>;
export type AgreementDocumentSQL = InferSelectModel<
  typeof agreementDocumentInReadmodel
>;
export type AgreementStampSQL = InferSelectModel<
  typeof agreementStampInReadmodel
>;
export type AgreementSQL = InferSelectModel<typeof agreementInReadmodel>;

export type TenantSQL = InferSelectModel<typeof tenantInReadmodel>;
export type TenantMailSQL = InferSelectModel<typeof tenantMailInReadmodel>;
export type TenantCertifiedAttributeSQL = InferSelectModel<
  typeof tenantCertifiedAttributeInReadmodel
>;
export type TenantDeclaredAttributeSQL = InferSelectModel<
  typeof tenantDeclaredAttributeInReadmodel
>;
export type TenantVerifiedAttributeSQL = InferSelectModel<
  typeof tenantVerifiedAttributeInReadmodel
>;
export type TenantVerifiedAttributeVerifierSQL = InferSelectModel<
  typeof tenantVerifiedAttributeVerifierInReadmodel
>;
export type TenantVerifiedAttributeRevokerSQL = InferSelectModel<
  typeof tenantVerifiedAttributeRevokerInReadmodel
>;
export type TenantFeatureSQL = InferSelectModel<
  typeof tenantFeatureInReadmodel
>;

export type PurposeSQL = InferSelectModel<typeof purposeInReadmodel>;
export type PurposeVersionSQL = InferSelectModel<
  typeof purposeVersionInReadmodel
>;
export type PurposeVersionDocumentSQL = InferSelectModel<
  typeof purposeVersionDocumentInReadmodel
>;
export type PurposeRiskAnalysisFormSQL = InferSelectModel<
  typeof purposeRiskAnalysisFormInReadmodel
>;
export type PurposeRiskAnalysisAnswerSQL = InferSelectModel<
  typeof purposeRiskAnalysisAnswerInReadmodel
>;

export type ClientSQL = InferSelectModel<typeof clientInReadmodel>;
export type ClientUserSQL = InferSelectModel<typeof clientUserInReadmodel>;
export type ClientPurposeSQL = InferSelectModel<
  typeof clientPurposeInReadmodel
>;
export type ClientKeySQL = InferSelectModel<typeof clientKeyInReadmodel>;

export type ProducerKeychainSQL = InferSelectModel<
  typeof producerKeychainInReadmodel
>;
export type ProducerKeychainUserSQL = InferSelectModel<
  typeof producerKeychainUserInReadmodel
>;
export type ProducerKeychainEServiceSQL = InferSelectModel<
  typeof producerKeychainEserviceInReadmodel
>;
export type ProducerKeychainKeySQL = InferSelectModel<
  typeof producerKeychainKeyInReadmodel
>;

export type ClientJWKKeySQL = InferSelectModel<typeof clientJwkKeyInReadmodel>;
