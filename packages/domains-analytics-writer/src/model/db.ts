export const CatalogDbTable = {
  eservice: "eservice",
  eservice_descriptor: "eservice_descriptor",
  eservice_descriptor_attribute: "eservice_descriptor_attribute",
  eservice_descriptor_document: "eservice_descriptor_document",
  eservice_descriptor_interface: "eservice_descriptor_interface",
  eservice_descriptor_rejection_reason: "eservice_descriptor_rejection_reason",
  eservice_descriptor_template_version_ref:
    "eservice_descriptor_template_version_ref",
  eservice_risk_analysis: "eservice_risk_analysis",
  eservice_risk_analysis_answer: "eservice_risk_analysis_answer",
} as const;

export const DeletingDbTable = {
  attribute_deleting_table: "attribute_deleting_table",
  catalog_deleting_table: "catalog_deleting_table",
  purpose_deleting_table: "purpose_deleting_table",
};

export const AttributeDbTable = {
  attribute: "attribute",
} as const;

export const PurposeDbTable = {
  purpose: "purpose",
  purpose_risk_analysis_form: "purpose_risk_analysis_form",
  purpose_risk_analysis_answer: "purpose_risk_analysis_answer",
  purpose_version: "purpose_version",
  purpose_version_document: "purpose_version_document",
} as const;

export type AttributeDbTable =
  (typeof AttributeDbTable)[keyof typeof AttributeDbTable];

export type CatalogDbTable =
  (typeof CatalogDbTable)[keyof typeof CatalogDbTable];

export type DeletingDbTable =
  (typeof DeletingDbTable)[keyof typeof DeletingDbTable];

export type PurposeDbTable =
  (typeof PurposeDbTable)[keyof typeof PurposeDbTable];
