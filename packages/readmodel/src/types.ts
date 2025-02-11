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
  purposeInReadmodel,
} from "./drizzle/schema.js";

export type PurposeSQL = InferSelectModel<typeof purposeInReadmodel>;
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
