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
import { extractProp } from "../../db/dbModelMetadataExtractor.js";

const CatalogTableMeta = {
  eservice: { schema: EserviceSchema, readModel: eserviceInReadmodelCatalog },
  eservice_descriptor: {
    schema: EserviceDescriptorSchema,
    readModel: eserviceDescriptorInReadmodelCatalog,
  },
  eservice_descriptor_attribute: {
    schema: EserviceDescriptorAttributeSchema,
    readModel: eserviceDescriptorAttributeInReadmodelCatalog,
  },
  eservice_descriptor_document: {
    schema: EserviceDescriptorDocumentSchema,
    readModel: eserviceDescriptorDocumentInReadmodelCatalog,
  },
  eservice_descriptor_interface: {
    schema: EserviceDescriptorInterfaceSchema,
    readModel: eserviceDescriptorInterfaceInReadmodelCatalog,
  },
  eservice_descriptor_rejection_reason: {
    schema: EserviceDescriptorRejectionReasonSchema,
    readModel: eserviceDescriptorRejectionReasonInReadmodelCatalog,
  },
  eservice_descriptor_template_version_ref: {
    schema: EserviceDescriptorTemplateVersionRefSchema,
    readModel: eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  },
  eservice_risk_analysis: {
    schema: EserviceRiskAnalysisSchema,
    readModel: eserviceRiskAnalysisInReadmodelCatalog,
  },
  eservice_risk_analysis_answer: {
    schema: EserviceRiskAnalysisAnswerSchema,
    readModel: eserviceRiskAnalysisAnswerInReadmodelCatalog,
  },
} as const;
export const CatalogDbTableConfig = extractProp(CatalogTableMeta, "schema");
export type CatalogDbTableConfig = typeof CatalogDbTableConfig;
export const CatalogDbTableReadModel = extractProp(
  CatalogTableMeta,
  "readModel"
);
export type CatalogDbTableReadModel = typeof CatalogDbTableReadModel;
export type CatalogDbTable = keyof typeof CatalogDbTableConfig;
export const CatalogDbTable = Object.fromEntries(
  Object.keys(CatalogDbTableConfig).map((k) => [k, k])
) as { [K in CatalogDbTable]: K };
