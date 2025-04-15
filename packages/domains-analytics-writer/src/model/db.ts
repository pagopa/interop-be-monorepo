export const CatalogDbTable = {
  eservice: "eservice",
  eservice_deleting: "eservice_deleting",
  eservice_descriptor: "eservice_descriptor",
  eservice_descriptor_attribute: "eservice_descriptor_attribute",
  eservice_descriptor_document: "eservice_descriptor_document",
  eservice_descriptor_interface: "eservice_descriptor_interface",
  eservice_descriptor_rejection_reason: "eservice_descriptor_rejection_reason",
  eservice_descriptor_template_version_ref:
    "eservice_descriptor_template_version_ref",
  eservice_risk_analysis: "eservice_risk_analysis",
  eservice_risk_analysis_answer: "eservice_risk_analysis_answer",
  eservice_template_ref: "eservice_template_ref",
  deleting_by_id_table: "deleting_by_id_table",
} as const;

export type CatalogDbTable =
  (typeof CatalogDbTable)[keyof typeof CatalogDbTable];
export const AttributeDbtable = {
  attribute: "attribute",
} as const;

export const DeletingDbTable = {
  attribute_deleting_table: "attribute_deleting_table",
  catalog_deleting_table: "catalog_deleting_table",
};

export type AttributeDbtable =
  (typeof AttributeDbtable)[keyof typeof AttributeDbtable];

export type DeletingDbTable =
  (typeof DeletingDbTable)[keyof typeof DeletingDbTable];
