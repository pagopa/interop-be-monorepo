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
