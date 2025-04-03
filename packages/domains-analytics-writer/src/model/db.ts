export const CatalogDbTable = {
  eservice: "eservice",
  eservice_deleting: "eservice_deleting",
  eservice_descriptor: "eservice_descriptor",
  eservice_descriptor_deleting: "eservice_descriptor_deleting",
  eservice_descriptor_attribute: "eservice_descriptor_attribute",
  eservice_descriptor_document: "eservice_descriptor_document",
  eservice_descriptor_document_deleting:
    "eservice_descriptor_document_deleting",
  eservice_descriptor_interface: "eservice_descriptor_interface",
  eservice_descriptor_rejection_reason: "eservice_descriptor_rejection_reason",
  eservice_descriptor_template_version_ref:
    "eservice_descriptor_template_version_ref",
  eservice_risk_analysis: "eservice_risk_analysis",
  eservice_risk_analysis_deleting: "eservice_risk_analysis_deleting",
  eservice_risk_analysis_answer: "eservice_risk_analysis_answer",
  eservice_template_ref: "eservice_template_ref",
} as const;

export type CatalogDbTable =
  (typeof CatalogDbTable)[keyof typeof CatalogDbTable];
