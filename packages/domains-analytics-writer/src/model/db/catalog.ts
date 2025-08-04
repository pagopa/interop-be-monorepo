import {
  eserviceInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { EserviceSchema } from "../catalog/eservice.js";
import { EserviceDescriptorSchema } from "../catalog/eserviceDescriptor.js";
import { EserviceDescriptorAttributeSchema } from "../catalog/eserviceDescriptorAttribute.js";
import { EserviceDescriptorDocumentSchema } from "../catalog/eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceSchema } from "../catalog/eserviceDescriptorInterface.js";
import { EserviceDescriptorRejectionReasonSchema } from "../catalog/eserviceDescriptorRejection.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "../catalog/eserviceDescriptorTemplateVersionRef.js";
import { EserviceRiskAnalysisSchema } from "../catalog/eserviceRiskAnalysis.js";
import { EserviceRiskAnalysisAnswerSchema } from "../catalog/eserviceRiskAnalysisAnswer.js";

export const CatalogDbTableConfig = {
  eservice: EserviceSchema,
  eservice_descriptor: EserviceDescriptorSchema,
  eservice_descriptor_attribute: EserviceDescriptorAttributeSchema,
  eservice_descriptor_document: EserviceDescriptorDocumentSchema,
  eservice_descriptor_interface: EserviceDescriptorInterfaceSchema,
  eservice_descriptor_rejection_reason: EserviceDescriptorRejectionReasonSchema,
  eservice_descriptor_template_version_ref:
    EserviceDescriptorTemplateVersionRefSchema,
  eservice_risk_analysis: EserviceRiskAnalysisSchema,
  eservice_risk_analysis_answer: EserviceRiskAnalysisAnswerSchema,
} as const;
export type CatalogDbTableConfig = typeof CatalogDbTableConfig;

export const CatalogDbTableReadModel = {
  eservice: eserviceInReadmodelCatalog,
  eservice_descriptor: eserviceDescriptorInReadmodelCatalog,
  eservice_descriptor_attribute: eserviceDescriptorAttributeInReadmodelCatalog,
  eservice_descriptor_document: eserviceDescriptorDocumentInReadmodelCatalog,
  eservice_descriptor_interface: eserviceDescriptorInterfaceInReadmodelCatalog,
  eservice_descriptor_rejection_reason:
    eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eservice_descriptor_template_version_ref:
    eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eservice_risk_analysis: eserviceRiskAnalysisInReadmodelCatalog,
  eservice_risk_analysis_answer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
} as const;
export type CatalogDbTableReadModel = typeof CatalogDbTableReadModel;

export type CatalogDbTable = keyof typeof CatalogDbTableConfig;

export const CatalogDbTable = Object.fromEntries(
  Object.keys(CatalogDbTableConfig).map((k) => [k, k])
) as { [K in CatalogDbTable]: K };
