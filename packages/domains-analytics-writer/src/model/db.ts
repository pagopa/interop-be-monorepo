export const CatalogDbTable = {
  eservice: "eservice_audit",
  eservice_deleting: "eservice_deleting_audit",
  eservice_descriptor: "eservice_descriptor_audit",
  eservice_descriptor_deleting: "eservice_descriptor_deleting_audit",
  eservice_descriptor_attribute: "eservice_descriptor_attribute_audit",
  eservice_descriptor_document: "eservice_descriptor_document_audit",
  eservice_descriptor_document_deleting:
    "eservice_descriptor_document_deleting_audit",
  eservice_descriptor_interface: "eservice_descriptor_interface_audit",
  eservice_descriptor_rejection_reason:
    "eservice_descriptor_rejection_reason_audit",
  eservice_descriptor_template_version_ref:
    "eservice_descriptor_template_version_ref_audit",
  eservice_risk_analysis: "eservice_risk_analysis_audit",
  eservice_risk_analysis_deleting: "eservice_risk_analysis_deleting_audit",
  eservice_risk_analysis_answer: "eservice_risk_analysis_answer_audit",
  eservice_template_ref: "eservice_template_ref_audit",
} as const;

export type CatalogDbTable =
  (typeof CatalogDbTable)[keyof typeof CatalogDbTable];
