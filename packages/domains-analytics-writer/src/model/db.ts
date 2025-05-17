import { z } from "zod";
import {
  attributeInReadmodelAttribute,
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
import {
  AttributeDeletingSchema,
  AttributeSchema,
} from "./attribute/attribute.js";
import { EserviceDeletingSchema, EserviceSchema } from "./catalog/eservice.js";
import { EserviceDescriptorSchema } from "./catalog/eserviceDescriptor.js";
import { EserviceDescriptorAttributeSchema } from "./catalog/eserviceDescriptorAttribute.js";
import { EserviceDescriptorDocumentSchema } from "./catalog/eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceSchema } from "./catalog/eserviceDescriptorInterface.js";
import { EserviceDescriptorRejectionReasonSchema } from "./catalog/eserviceDescriptorRejection.js";
import { EserviceDescriptorTemplateVersionRefSchema } from "./catalog/eserviceDescriptorTemplateVersionRef.js";
import {
  EserviceRiskAnalysisDeletingSchema,
  EserviceRiskAnalysisSchema,
} from "./catalog/eserviceRiskAnalysis.js";
import { EserviceRiskAnalysisAnswerSchema } from "./catalog/eserviceRiskAnalysisAnswer.js";

/**
 * Extracts a single property from a metadata map.
 *
 * @template M - The metadata map type, mapping keys to objects
 * @template P - The property name within each metadata value to extract
 * @param meta - The metadata object containing mappings of table info
 * @param prop - The property to extract from each metadata entry (e.g. "schema" or "readModel")
 * @returns A new object mapping each key to the extracted property value
 */
function extractProp<
  M extends Record<string, Record<string, unknown>>,
  P extends keyof M[keyof M]
>(meta: M, prop: P): { [K in keyof M]: M[K][P] } {
  return Object.keys(meta).reduce(
    (acc, key) => ({
      ...acc,
      [key]: meta[key as keyof M][prop],
    }),
    {} as { [K in keyof M]: M[K][P] }
  );
}

// ---------- ATTRIBUTE ----------

const AttributeTableMeta = {
  attribute: {
    schema: AttributeSchema,
    readModel: attributeInReadmodelAttribute,
  },
} as const;
export const AttributeDbTableConfig = extractProp(AttributeTableMeta, "schema");
export type AttributeDbTableConfig = typeof AttributeDbTableConfig;
export const AttributeDbTableReadModel = extractProp(
  AttributeTableMeta,
  "readModel"
);
export type AttributeDbTableReadModel = typeof AttributeDbTableReadModel;
export type AttributeDbTable = keyof typeof AttributeDbTableConfig;
export const AttributeDbTable = Object.fromEntries(
  Object.keys(AttributeDbTableConfig).map((k) => [k, k])
) as { [K in AttributeDbTable]: K };

// ---------- CATALOG ----------

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

// ---------- DELETING ----------

const DeletingTableMeta = {
  attribute_deleting_table: {
    schema: AttributeDeletingSchema,
    readModel: attributeInReadmodelAttribute,
  },
  catalog_deleting_table: {
    schema: EserviceDeletingSchema,
    readModel: eserviceInReadmodelCatalog,
  },
  catalog_risk_deleting_table: {
    schema: EserviceRiskAnalysisDeletingSchema,
    readModel: eserviceRiskAnalysisInReadmodelCatalog,
  },
} as const;
export const DeletingDbTableConfig = extractProp(DeletingTableMeta, "schema");
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = extractProp(
  DeletingTableMeta,
  "readModel"
);
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

// ---------- TABLES CONFIG ----------

export const DomainDbTable = {
  ...AttributeDbTableConfig,
  ...CatalogDbTableConfig,
} as const;
export type DomainDbTableSchemas = typeof DomainDbTable;
export type DomainDbTable = keyof DomainDbTableSchemas;

export const DbTable = {
  ...DomainDbTable,
  ...DeletingDbTableConfig,
} as const;
export type DbTableSchemas = typeof DbTable;
export type DbTable = keyof DbTableSchemas;

export const DomainDbTableReadModels = {
  ...AttributeDbTableReadModel,
  ...CatalogDbTableReadModel,
} as const;
export type DomainDbTableReadModels = typeof DomainDbTableReadModels;

export const DbTableReadModels = {
  ...DomainDbTableReadModels,
  ...DeletingDbTableReadModel,
} as const;
export type DbTableReadModels = typeof DbTableReadModels;
