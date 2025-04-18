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
} as const;

export type CatalogDbTable =
  (typeof CatalogDbTable)[keyof typeof CatalogDbTable];
export const AttributeDbtable = {
  attribute: "attribute",
} as const;

export const DeletingDbTable = {
  attribute_deleting_table: "attribute_deleting_table",
  catalog_deleting_table: "catalog_deleting_table",
  agreement_deleting_table: "agreement_deleting_table",
};

export const AgreementDbTable = {
  agreement: "agreement",
  agreement_stamp: "agreement_stamp",
  agreement_attribute: "agreement_attribute",
  agreement_consumer_document: "agreement_consumer_document",
  agreement_contract: "agreement_contract",
} as const;

export type AgreementDbTable =
  (typeof AgreementDbTable)[keyof typeof AgreementDbTable];

export type AttributeDbtable =
  (typeof AttributeDbtable)[keyof typeof AttributeDbtable];

export type DeletingDbTable =
  (typeof DeletingDbTable)[keyof typeof DeletingDbTable];
