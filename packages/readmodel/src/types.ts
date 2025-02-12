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
