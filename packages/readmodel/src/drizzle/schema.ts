import {
  pgSchema,
  uuid,
  varchar,
  timestamp,
  integer,
  // eslint-disable-next-line id-blacklist
  boolean,
  foreignKey,
  json,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

export const readmodel = pgSchema("readmodel");

export const attributeInReadmodel = readmodel.table("attribute", {
  id: uuid().primaryKey().notNull(),
  code: varchar(),
  kind: varchar().notNull(),
  description: varchar().notNull(),
  origin: varchar(),
  name: varchar().notNull(),
  creationTime: timestamp("creation_time", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export const purposeInReadmodel = readmodel.table("purpose", {
  id: uuid().primaryKey().notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  consumerId: uuid("consumer_id").notNull(),
  delegationId: uuid("delegation_id"),
  suspendedByConsumer: boolean("suspended_by_consumer"),
  suspendedByProducer: boolean("suspended_by_producer"),
  title: varchar().notNull(),
  description: varchar().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  isFreeOfCharge: boolean("is_free_of_charge").notNull(),
  freeOfChargeReason: varchar("free_of_charge_reason"),
});

export const purposeRiskAnalysisFormInReadmodel = readmodel.table(
  "purpose_risk_analysis_form",
  {
    id: uuid().primaryKey().notNull(),
    purposeId: uuid("purpose_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    version: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodel.id],
      name: "purpose_risk_analysis_form_purpose_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const purposeRiskAnalysisAnswerInReadmodel = readmodel.table(
  "purpose_risk_analysis_answer",
  {
    id: uuid().primaryKey().notNull(),
    purposeId: uuid("purpose_id"),
    metadataVersion: integer("metadata_version").notNull(),
    riskAnalysisFormId: uuid("risk_analysis_form_id"),
    kind: varchar().notNull(),
    key: varchar().notNull(),
    value: varchar().array(),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodel.id],
      name: "purpose_risk_analysis_answer_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.riskAnalysisFormId],
      foreignColumns: [purposeRiskAnalysisFormInReadmodel.id],
      name: "purpose_risk_analysis_answer_risk_analysis_form_id_fkey",
    }),
  ]
);

export const purposeVersionInReadmodel = readmodel.table(
  "purpose_version",
  {
    id: uuid().primaryKey().notNull(),
    purposeId: uuid("purpose_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    state: varchar().notNull(),
    dailyCalls: integer("daily_calls").notNull(),
    rejectionReason: varchar("rejection_reason"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    firstActivationAt: timestamp("first_activation_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodel.id],
      name: "purpose_version_purpose_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const producerKeychainInReadmodel = readmodel.table(
  "producer_keychain",
  {
    id: uuid().primaryKey().notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    producerId: uuid("producer_id").notNull(),
    name: varchar().notNull(),
    description: varchar(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  }
);

export const purposeVersionDocumentInReadmodel = readmodel.table(
  "purpose_version_document",
  {
    purposeId: uuid("purpose_id"),
    metadataVersion: integer("metadata_version").notNull(),
    purposeVersionId: uuid("purpose_version_id"),
    id: uuid().primaryKey().notNull(),
    contentType: varchar("content_type").notNull(),
    path: varchar().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodel.id],
      name: "purpose_version_document_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeVersionId],
      foreignColumns: [purposeVersionInReadmodel.id],
      name: "purpose_version_document_purpose_version_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const clientJwkKeyInReadmodel = readmodel.table("client_jwk_key", {
  clientId: uuid("client_id").notNull(),
  version: integer().notNull(),
  alg: varchar().notNull(),
  e: varchar().notNull(),
  kid: varchar().primaryKey().notNull(),
  kty: varchar().notNull(),
  n: varchar().notNull(),
  use: varchar().notNull(),
});

export const producerKeychainKeyInReadmodel = readmodel.table(
  "producer_keychain_key",
  {
    metadataVersion: integer("metadata_version").notNull(),
    producerKeychainId: uuid("producer_keychain_id").notNull(),
    userId: uuid("user_id").notNull(),
    kid: varchar().primaryKey().notNull(),
    name: varchar().notNull(),
    encodedPem: varchar("encoded_pem").notNull(),
    algorithm: varchar().notNull(),
    use: varchar().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.producerKeychainId],
      foreignColumns: [producerKeychainInReadmodel.id],
      name: "producer_keychain_key_producer_keychain_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const producerJwkKeyInReadmodel = readmodel.table("producer_jwk_key", {
  producerKeychainId: uuid("producer_keychain_id").notNull(),
  version: integer().notNull(),
  alg: varchar().notNull(),
  e: varchar().notNull(),
  kid: varchar().primaryKey().notNull(),
  kty: varchar().notNull(),
  n: varchar().notNull(),
  use: varchar().notNull(),
});

export const tenantInReadmodel = readmodel.table("tenant", {
  id: uuid().primaryKey().notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  kind: varchar(),
  selfcareId: varchar("selfcare_id"),
  externalIdOrigin: varchar("external_id_origin").notNull(),
  externalIdValue: varchar("external_id_value").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  name: varchar().notNull(),
  onboardedAt: timestamp("onboarded_at", {
    withTimezone: true,
    mode: "string",
  }),
  subUnitType: varchar("sub_unit_type"),
});

export const tenantMailInReadmodel = readmodel.table(
  "tenant_mail",
  {
    id: varchar().primaryKey().notNull(),
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    kind: varchar().notNull(),
    address: varchar(),
    description: varchar(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_mail_tenant_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const tenantFeatureInReadmodel = readmodel.table(
  "tenant_feature",
  {
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    kind: varchar().notNull(),
    details: json().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_feature_tenant_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const clientInReadmodel = readmodel.table("client", {
  id: uuid().primaryKey().notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  consumerId: uuid("consumer_id").notNull(),
  name: varchar().notNull(),
  description: varchar(),
  kind: varchar().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});

export const eserviceInReadmodel = readmodel.table("eservice", {
  id: uuid().primaryKey().notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  producerId: uuid("producer_id").notNull(),
  name: varchar().notNull(),
  description: varchar().notNull(),
  technology: varchar().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  mode: varchar().notNull(),
  isSignalHubEnabled: boolean("is_signal_hub_enabled"),
  isConsumerDelegable: boolean("is_consumer_delegable"),
  isClientAccessDelegable: boolean("is_client_access_delegable"),
});

export const eserviceDescriptorInReadmodel = readmodel.table(
  "eservice_descriptor",
  {
    id: uuid().primaryKey().notNull(),
    eserviceId: uuid("eservice_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    version: varchar().notNull(),
    description: varchar(),
    state: varchar().notNull(),
    audience: varchar().array().notNull(),
    voucherLifespan: integer("voucher_lifespan").notNull(),
    dailyCallsPerConsumer: integer("daily_calls_per_consumer").notNull(),
    dailyCallsTotal: integer("daily_calls_total").notNull(),
    agreementApprovalPolicy: varchar("agreement_approval_policy"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    serverUrls: varchar("server_urls").array().notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "string",
    }),
    deprecatedAt: timestamp("deprecated_at", {
      withTimezone: true,
      mode: "string",
    }),
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_descriptor_eservice_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const eserviceDescriptorRejectionReasonInReadmodel = readmodel.table(
  "eservice_descriptor_rejection_reason",
  {
    eserviceId: uuid("eservice_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    descriptorId: uuid("descriptor_id").notNull(),
    rejectionReason: varchar("rejection_reason").notNull(),
    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_descriptor_rejection_reason_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.descriptorId],
      foreignColumns: [eserviceDescriptorInReadmodel.id],
      name: "eservice_descriptor_rejection_reason_descriptor_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const eserviceDescriptorDocumentInReadmodel = readmodel.table(
  "eservice_descriptor_document",
  {
    id: uuid().primaryKey().notNull(),
    eserviceId: uuid("eservice_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    descriptorId: uuid("descriptor_id").notNull(),
    name: varchar().notNull(),
    contentType: varchar("content_type").notNull(),
    prettyName: varchar("pretty_name").notNull(),
    path: varchar().notNull(),
    checksum: varchar().notNull(),
    uploadDate: timestamp("upload_date", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_descriptor_document_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.descriptorId],
      foreignColumns: [eserviceDescriptorInReadmodel.id],
      name: "eservice_descriptor_document_descriptor_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const eserviceRiskAnalysisInReadmodel = readmodel.table(
  "eservice_risk_analysis",
  {
    id: uuid().primaryKey().notNull(),
    eserviceId: uuid("eservice_id"),
    metadataVersion: integer("metadata_version").notNull(),
    name: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
    riskAnalysisFormVersion: varchar("risk_analysis_form_version").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_risk_analysis_eservice_id_fkey",
    }).onDelete("cascade"),
    unique("eservice_risk_analysis_risk_analysis_form_id_key").on(
      table.riskAnalysisFormId
    ),
  ]
);

export const eserviceRiskAnalysisAnswerInReadmodel = readmodel.table(
  "eservice_risk_analysis_answer",
  {
    id: uuid().primaryKey().notNull(),
    eserviceId: uuid("eservice_id"),
    metadataVersion: integer("metadata_version").notNull(),
    riskAnalysisFormId: uuid("risk_analysis_form_id"),
    kind: varchar().notNull(),
    key: varchar().notNull(),
    value: varchar().array().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_risk_analysis_answer_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.riskAnalysisFormId],
      foreignColumns: [eserviceRiskAnalysisInReadmodel.riskAnalysisFormId],
      name: "eservice_risk_analysis_answer_risk_analysis_form_id_fkey",
    }),
  ]
);

export const clientKeyInReadmodel = readmodel.table(
  "client_key",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id").notNull(),
    kid: varchar().primaryKey().notNull(),
    name: varchar().notNull(),
    encodedPem: varchar("encoded_pem").notNull(),
    algorithm: varchar().notNull(),
    use: varchar().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clientInReadmodel.id],
      name: "client_key_client_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const agreementInReadmodel = readmodel.table("agreement", {
  id: uuid().primaryKey().notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  descriptorId: uuid("descriptor_id").notNull(),
  producerId: uuid("producer_id").notNull(),
  consumerId: uuid("consumer_id").notNull(),
  state: varchar().notNull(),
  suspendedByConsumer: boolean("suspended_by_consumer"),
  suspendedByProducer: boolean("suspended_by_producer"),
  suspendedByPlatform: boolean("suspended_by_platform"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  consumerNotes: varchar("consumer_notes"),
  rejectionReason: varchar("rejection_reason"),
  suspendedAt: timestamp("suspended_at", {
    withTimezone: true,
    mode: "string",
  }),
});

export const agreementDocumentInReadmodel = readmodel.table(
  "agreement_document",
  {
    id: uuid().primaryKey().notNull(),
    agreementId: uuid("agreement_id"),
    metadataVersion: integer("metadata_version").notNull(),
    name: varchar().notNull(),
    prettyName: varchar("pretty_name").notNull(),
    contentType: varchar("content_type").notNull(),
    path: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agreementId],
      foreignColumns: [agreementInReadmodel.id],
      name: "agreement_document_agreement_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const delegationInReadmodel = readmodel.table("delegation", {
  id: uuid().primaryKey().notNull(),
  metadataVersion: integer("metadata_version").notNull(),
  delegatorId: uuid("delegator_id").notNull(),
  delegateId: uuid("delegate_id").notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  submittedAt: timestamp("submitted_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "string" }),
  rejectionReason: varchar("rejection_reason"),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  state: varchar().notNull(),
  kind: varchar().notNull(),
});

export const delegationContractDocumentInReadmodel = readmodel.table(
  "delegation_contract_document",
  {
    id: uuid().primaryKey().notNull(),
    delegationId: uuid("delegation_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    name: varchar().notNull(),
    contentType: varchar("content_type").notNull(),
    prettyName: varchar("pretty_name").notNull(),
    path: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.delegationId],
      foreignColumns: [delegationInReadmodel.id],
      name: "delegation_contract_document_delegation_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const eserviceTemplateInReadmodel = readmodel.table(
  "eservice_template",
  {
    id: uuid().primaryKey().notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    creatorId: uuid("creator_id").notNull(),
    name: varchar().notNull(),
    audienceDescription: varchar("audience_description").notNull(),
    eserviceDescription: varchar("eservice_description").notNull(),
    technology: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    mode: varchar().notNull(),
    isSignalHubEnabled: boolean("is_signal_hub_enabled"),
    isDelegable: boolean("is_delegable"),
    isClientAccessDelegable: boolean("is_client_access_delegable"),
  }
);

export const eserviceTemplateVersionInReadmodel = readmodel.table(
  "eservice_template_version",
  {
    id: uuid().primaryKey().notNull(),
    eserviceTemplateId: uuid("eservice_template_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    version: varchar().notNull(),
    description: varchar(),
    state: varchar().notNull(),
    voucherLifespan: integer("voucher_lifespan").notNull(),
    dailyCallsPerConsumer: integer("daily_calls_per_consumer"),
    dailyCallsTotal: integer("daily_calls_total"),
    agreementApprovalPolicy: varchar("agreement_approval_policy"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    serverUrls: varchar("server_urls").array().notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    suspendedAt: timestamp("suspended_at", {
      withTimezone: true,
      mode: "string",
    }),
    deprecatedAt: timestamp("deprecated_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceTemplateId],
      foreignColumns: [eserviceTemplateInReadmodel.id],
      name: "eservice_template_version_eservice_template_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const eserviceTemplateVersionDocumentInReadmodel = readmodel.table(
  "eservice_template_version_document",
  {
    id: uuid().primaryKey().notNull(),
    eserviceTemplateId: uuid("eservice_template_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    eserviceTemplateVersionId: uuid("eservice_template_version_id").notNull(),
    name: varchar(),
    contentType: varchar("content_type").notNull(),
    prettyName: varchar("pretty_name").notNull(),
    path: varchar().notNull(),
    checksum: varchar().notNull(),
    uploadDate: timestamp("upload_date", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceTemplateId],
      foreignColumns: [eserviceTemplateInReadmodel.id],
      name: "eservice_template_version_document_eservice_template_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eserviceTemplateVersionId],
      foreignColumns: [eserviceTemplateVersionInReadmodel.id],
      name: "eservice_template_version_doc_eservice_template_version_id_fkey",
    }).onDelete("cascade"),
  ]
);

export const eserviceTemplateRiskAnalysisAnswerInReadmodel = readmodel.table(
  "eservice_template_risk_analysis_answer",
  {
    id: uuid().primaryKey().notNull(),
    eserviceTemplateId: uuid("eservice_template_id"),
    metadataVersion: integer("metadata_version").notNull(),
    riskAnalysisFormId: uuid("risk_analysis_form_id"),
    kind: varchar(),
    key: varchar(),
    value: varchar().array(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceTemplateId],
      foreignColumns: [eserviceTemplateInReadmodel.id],
      name: "eservice_template_risk_analysis_answe_eservice_template_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.riskAnalysisFormId],
      foreignColumns: [eserviceRiskAnalysisInReadmodel.riskAnalysisFormId],
      name: "eservice_template_risk_analysis_answ_risk_analysis_form_id_fkey",
    }),
  ]
);

export const eserviceTemplateRiskAnalysisInReadmodel = readmodel.table(
  "eservice_template_risk_analysis",
  {
    id: uuid().primaryKey().notNull(),
    eserviceTemplateId: uuid("eservice_template_id"),
    metadataVersion: integer("metadata_version").notNull(),
    name: varchar(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
    riskAnalysisFormId: uuid("risk_analysis_form_id"),
    riskAnalysisFormVersion: varchar("risk_analysis_form_version"),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceTemplateId],
      foreignColumns: [eserviceTemplateInReadmodel.id],
      name: "eservice_template_risk_analysis_eservice_template_id_fkey",
    }).onDelete("cascade"),
    unique("eservice_template_risk_analysis_risk_analysis_form_id_key").on(
      table.riskAnalysisFormId
    ),
  ]
);

export const producerKeychainUserInReadmodel = readmodel.table(
  "producer_keychain_user",
  {
    metadataVersion: integer("metadata_version").notNull(),
    producerKeychainId: uuid("producer_keychain_id").notNull(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.producerKeychainId],
      foreignColumns: [producerKeychainInReadmodel.id],
      name: "producer_keychain_user_producer_keychain_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.producerKeychainId, table.userId],
      name: "producer_keychain_user_pkey",
    }),
  ]
);

export const producerKeychainEserviceInReadmodel = readmodel.table(
  "producer_keychain_eservice",
  {
    metadataVersion: integer("metadata_version").notNull(),
    producerKeychainId: uuid("producer_keychain_id").notNull(),
    eserviceId: uuid("eservice_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.producerKeychainId],
      foreignColumns: [producerKeychainInReadmodel.id],
      name: "producer_keychain_eservice_producer_keychain_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "producer_keychain_eservice_eservice_id_fkey",
    }),
    primaryKey({
      columns: [table.producerKeychainId, table.eserviceId],
      name: "producer_keychain_eservice_pkey",
    }),
  ]
);

export const clientUserInReadmodel = readmodel.table(
  "client_user",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clientInReadmodel.id],
      name: "client_user_client_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.clientId, table.userId],
      name: "client_user_pkey",
    }),
  ]
);

export const clientPurposeInReadmodel = readmodel.table(
  "client_purpose",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
    purposeId: uuid("purpose_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clientInReadmodel.id],
      name: "client_purpose_client_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.clientId, table.purposeId],
      name: "client_purpose_pkey",
    }),
  ]
);

export const tenantVerifiedAttributeInReadmodel = readmodel.table(
  "tenant_verified_attribute",
  {
    attributeId: uuid("attribute_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    assignmentTimestamp: timestamp("assignment_timestamp", {
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_verified_attribute_tenant_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.attributeId, table.tenantId],
      name: "tenant_verified_attribute_pkey",
    }),
  ]
);

export const agreementAttributeInReadmodel = readmodel.table(
  "agreement_attribute",
  {
    agreementId: uuid("agreement_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    attributeId: uuid("attribute_id").notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agreementId],
      foreignColumns: [agreementInReadmodel.id],
      name: "agreement_attribute_agreement_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.agreementId, table.attributeId],
      name: "agreement_attribute_pkey",
    }),
  ]
);

export const tenantCertifiedAttributeInReadmodel = readmodel.table(
  "tenant_certified_attribute",
  {
    id: uuid().notNull(),
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    assignmentTimestamp: timestamp("assignment_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    revocationTimestamp: timestamp("revocation_timestamp", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [attributeInReadmodel.id],
      name: "tenant_certified_attribute_id_fkey",
    }),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_certified_attribute_tenant_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.id, table.tenantId],
      name: "tenant_certified_attribute_pkey",
    }),
  ]
);

export const tenantDeclaredAttributeInReadmodel = readmodel.table(
  "tenant_declared_attribute",
  {
    attributeId: uuid("attribute_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    assignmentTimestamp: timestamp("assignment_timestamp", {
      mode: "string",
    }).notNull(),
    revocationTimestamp: timestamp("revocation_timestamp", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_declared_attribute_tenant_id_fkey",
    }),
    primaryKey({
      columns: [table.attributeId, table.tenantId],
      name: "tenant_declared_attribute_pkey",
    }),
  ]
);

export const delegationStampInReadmodel = readmodel.table(
  "delegation_stamp",
  {
    delegationId: uuid("delegation_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    who: uuid().notNull(),
    when: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.delegationId],
      foreignColumns: [delegationInReadmodel.id],
      name: "delegation_stamp_delegation_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.delegationId, table.kind],
      name: "delegation_stamp_pkey",
    }),
  ]
);

export const agreementStampInReadmodel = readmodel.table(
  "agreement_stamp",
  {
    agreementId: uuid("agreement_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    who: uuid().notNull(),
    delegationId: uuid("delegation_id"),
    when: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agreementId],
      foreignColumns: [agreementInReadmodel.id],
      name: "agreement_stamp_agreement_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.agreementId, table.kind],
      name: "agreement_stamp_pkey",
    }),
  ]
);

export const eserviceDescriptorAttributeInReadmodel = readmodel.table(
  "eservice_descriptor_attribute",
  {
    attributeId: uuid("attribute_id").notNull(),
    eserviceId: uuid("eservice_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    descriptorId: uuid("descriptor_id").notNull(),
    explicitAttributeVerification: boolean(
      "explicit_attribute_verification"
    ).notNull(),
    kind: varchar().notNull(),
    groupId: integer("group_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_descriptor_attribute_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.descriptorId],
      foreignColumns: [eserviceDescriptorInReadmodel.id],
      name: "eservice_descriptor_attribute_descriptor_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.attributeId, table.descriptorId, table.groupId],
      name: "eservice_descriptor_attribute_pkey",
    }),
  ]
);

export const eserviceTemplateVersionAttributeInReadmodel = readmodel.table(
  "eservice_template_version_attribute",
  {
    id: uuid().notNull(),
    eserviceTemplateId: uuid("eservice_template_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    eserviceTemplateVersionId: uuid("eservice_template_version_id").notNull(),
    explicitAttributeVerification: boolean(
      "explicit_attribute_verification"
    ).notNull(),
    kind: varchar().notNull(),
    groupId: integer("group_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceTemplateId],
      foreignColumns: [eserviceTemplateInReadmodel.id],
      name: "eservice_template_version_attribute_eservice_template_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eserviceTemplateVersionId],
      foreignColumns: [eserviceTemplateVersionInReadmodel.id],
      name: "eservice_template_version_att_eservice_template_version_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.id, table.eserviceTemplateVersionId, table.groupId],
      name: "eservice_template_version_attribute_pkey",
    }),
  ]
);

export const tenantVerifiedAttributeVerifierInReadmodel = readmodel.table(
  "tenant_verified_attribute_verifier",
  {
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    id: uuid().notNull(),
    tenantVerifiedAttributeId: uuid("tenant_verified_attribute_id").notNull(),
    verificationDate: timestamp("verification_date", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    expirationDate: timestamp("expiration_date", {
      withTimezone: true,
      mode: "string",
    }),
    extensionDate: timestamp("extension_date", {
      withTimezone: true,
      mode: "string",
    }),
    delegationId: uuid("delegation_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_verified_attribute_verifier_tenant_id_fkey",
    }),
    foreignKey({
      columns: [table.id],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_verified_attribute_verifier_id_fkey",
    }),
    foreignKey({
      columns: [table.tenantVerifiedAttributeId],
      foreignColumns: [attributeInReadmodel.id],
      name: "tenant_verified_attribute_ver_tenant_verified_attribute_id_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.tenantVerifiedAttributeId],
      foreignColumns: [
        tenantVerifiedAttributeInReadmodel.attributeId,
        tenantVerifiedAttributeInReadmodel.tenantId,
      ],
      name: "tenant_verified_attribute_ver_tenant_id_tenant_verified_at_fkey",
    }),
    primaryKey({
      columns: [table.tenantId, table.id, table.tenantVerifiedAttributeId],
      name: "tenant_verified_attribute_verifier_pkey",
    }),
  ]
);

export const tenantVerifiedAttributeRevokerInReadmodel = readmodel.table(
  "tenant_verified_attribute_revoker",
  {
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    id: uuid().notNull(),
    tenantVerifiedAttributeId: uuid("tenant_verified_attribute_id").notNull(),
    verificationDate: timestamp("verification_date", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    expirationDate: timestamp("expiration_date", {
      withTimezone: true,
      mode: "string",
    }),
    extensionDate: timestamp("extension_date", {
      withTimezone: true,
      mode: "string",
    }),
    revocationDate: timestamp("revocation_date", { mode: "string" }).notNull(),
    delegationId: uuid("delegation_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_verified_attribute_revoker_tenant_id_fkey",
    }),
    foreignKey({
      columns: [table.id],
      foreignColumns: [tenantInReadmodel.id],
      name: "tenant_verified_attribute_revoker_id_fkey",
    }),
    foreignKey({
      columns: [table.tenantId, table.tenantVerifiedAttributeId],
      foreignColumns: [
        tenantVerifiedAttributeInReadmodel.attributeId,
        tenantVerifiedAttributeInReadmodel.tenantId,
      ],
      name: "tenant_verified_attribute_rev_tenant_id_tenant_verified_at_fkey",
    }),
    primaryKey({
      columns: [table.tenantId, table.id, table.tenantVerifiedAttributeId],
      name: "tenant_verified_attribute_revoker_pkey",
    }),
  ]
);

export const eserviceTemplateBindingInReadmodel = readmodel.table(
  "eservice_template_binding",
  {
    eserviceId: uuid("eservice_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    eserviceTemplateId: uuid("eservice_template_id").notNull(),
    instanceId: varchar("instance_id"),
    name: varchar(),
    email: varchar(),
    url: varchar(),
    termsAndConditionsUrl: varchar("terms_and_conditions_url"),
    serverUrl: varchar("server_url"),
  },
  (table) => [
    foreignKey({
      columns: [table.eserviceId],
      foreignColumns: [eserviceInReadmodel.id],
      name: "eservice_template_binding_eservice_id_fkey",
    }),
    primaryKey({
      columns: [table.eserviceId, table.eserviceTemplateId],
      name: "eservice_template_binding_pkey",
    }),
  ]
);
