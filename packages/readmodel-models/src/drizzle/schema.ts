import {
  unique,
  uuid,
  integer,
  varchar,
  // eslint-disable-next-line id-blacklist
  boolean,
  timestamp,
  foreignKey,
  primaryKey,
} from "drizzle-orm/pg-core";
import {
  readmodelAgreement,
  readmodelAttribute,
  readmodelDelegation,
  readmodelCatalog,
  readmodelClient,
  readmodelProducerKeychain,
  readmodelPurpose,
  readmodelPurposeTemplate,
  readmodelTenant,
  readmodelClientJwkKey,
  readmodelProducerJwkKey,
  readmodelEserviceTemplate,
  readmodelNotificationConfig,
} from "../pgSchema.js";

export const agreementInReadmodelAgreement = readmodelAgreement.table(
  "agreement",
  {
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
  },
  (table) => [
    unique("agreement_id_metadata_version_unique").on(
      table.id,
      table.metadataVersion
    ),
  ]
);

export const eserviceTemplateInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template",
    {
      id: uuid().primaryKey().notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      creatorId: uuid("creator_id").notNull(),
      name: varchar().notNull(),
      intendedTarget: varchar("intended_target").notNull(),
      description: varchar().notNull(),
      technology: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
      mode: varchar().notNull(),
      isSignalHubEnabled: boolean("is_signal_hub_enabled"),
      personalData: boolean("personal_data"),
    },
    (table) => [
      unique("eservice_template_id_metadata_version_unique").on(
        table.id,
        table.metadataVersion
      ),
    ]
  );

export const eserviceTemplateVersionInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template_version",
    {
      id: uuid().primaryKey().notNull(),
      eserviceTemplateId: uuid("eservice_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      version: integer().notNull(),
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
        foreignColumns: [eserviceTemplateInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceTemplateId, table.metadataVersion],
        foreignColumns: [
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
        ],
        name: "eservice_template_version_eservice_template_id_metadata_ve_fkey",
      }),
    ]
  );

export const agreementConsumerDocumentInReadmodelAgreement =
  readmodelAgreement.table(
    "agreement_consumer_document",
    {
      id: uuid().primaryKey().notNull(),
      agreementId: uuid("agreement_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      name: varchar().notNull(),
      prettyName: varchar("pretty_name").notNull(),
      contentType: varchar("content_type").notNull(),
      path: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.agreementId],
        foreignColumns: [agreementInReadmodelAgreement.id],
        name: "agreement_consumer_document_agreement_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.agreementId, table.metadataVersion],
        foreignColumns: [
          agreementInReadmodelAgreement.id,
          agreementInReadmodelAgreement.metadataVersion,
        ],
        name: "agreement_consumer_document_agreement_id_metadata_version_fkey",
      }),
    ]
  );

export const agreementContractInReadmodelAgreement = readmodelAgreement.table(
  "agreement_contract",
  {
    id: uuid().notNull(),
    agreementId: uuid("agreement_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    name: varchar().notNull(),
    prettyName: varchar("pretty_name").notNull(),
    contentType: varchar("content_type").notNull(),
    path: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agreementId],
      foreignColumns: [agreementInReadmodelAgreement.id],
      name: "agreement_contract_agreement_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agreementId, table.metadataVersion],
      foreignColumns: [
        agreementInReadmodelAgreement.id,
        agreementInReadmodelAgreement.metadataVersion,
      ],
      name: "agreement_contract_agreement_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.id, table.agreementId],
      name: "agreement_contract_pkey",
    }),
    unique("agreement_contract_agreement_id_key").on(table.agreementId),
  ]
);

export const eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template_version_interface",
    {
      id: uuid().primaryKey().notNull(),
      eserviceTemplateId: uuid("eservice_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      versionId: uuid("version_id").notNull(),
      name: varchar().notNull(),
      contentType: varchar("content_type").notNull(),
      prettyName: varchar("pretty_name").notNull(),
      path: varchar().notNull(),
      checksum: varchar().notNull(),
      uploadDate: timestamp("upload_date", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceTemplateId],
        foreignColumns: [eserviceTemplateInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_interface_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.versionId],
        foreignColumns: [eserviceTemplateVersionInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_interface_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceTemplateId, table.metadataVersion],
        foreignColumns: [
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
        ],
        name: "eservice_template_version_int_eservice_template_id_metadat_fkey",
      }),
      unique("eservice_template_version_interface_version_id_key").on(
        table.versionId
      ),
    ]
  );

export const producerKeychainInReadmodelProducerKeychain =
  readmodelProducerKeychain.table(
    "producer_keychain",
    {
      id: uuid().primaryKey().notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      producerId: uuid("producer_id").notNull(),
      name: varchar().notNull(),
      description: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      unique("producer_keychain_id_metadata_version_unique").on(
        table.id,
        table.metadataVersion
      ),
    ]
  );

export const eserviceTemplateVersionDocumentInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template_version_document",
    {
      id: uuid().primaryKey().notNull(),
      eserviceTemplateId: uuid("eservice_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      versionId: uuid("version_id").notNull(),
      name: varchar().notNull(),
      contentType: varchar("content_type").notNull(),
      prettyName: varchar("pretty_name").notNull(),
      path: varchar().notNull(),
      checksum: varchar().notNull(),
      uploadDate: timestamp("upload_date", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceTemplateId],
        foreignColumns: [eserviceTemplateInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_document_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.versionId],
        foreignColumns: [eserviceTemplateVersionInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_document_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceTemplateId, table.metadataVersion],
        foreignColumns: [
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
        ],
        name: "eservice_template_version_doc_eservice_template_id_metadat_fkey",
      }),
    ]
  );

export const attributeInReadmodelAttribute = readmodelAttribute.table(
  "attribute",
  {
    id: uuid().primaryKey().notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    code: varchar(),
    kind: varchar().notNull(),
    description: varchar().notNull(),
    origin: varchar(),
    name: varchar().notNull(),
    creationTime: timestamp("creation_time", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  }
);

export const delegationInReadmodelDelegation = readmodelDelegation.table(
  "delegation",
  {
    id: uuid().primaryKey().notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    delegatorId: uuid("delegator_id").notNull(),
    delegateId: uuid("delegate_id").notNull(),
    eserviceId: uuid("eservice_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
    rejectionReason: varchar("rejection_reason"),
    state: varchar().notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    unique("delegation_id_metadata_version_unique").on(
      table.id,
      table.metadataVersion
    ),
  ]
);

export const eserviceInReadmodelCatalog = readmodelCatalog.table(
  "eservice",
  {
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
    templateId: uuid("template_id"),
    personalData: boolean("personal_data"),
  },
  (table) => [
    unique("eservice_id_metadata_version_unique").on(
      table.id,
      table.metadataVersion
    ),
  ]
);

export const eserviceDescriptorInReadmodelCatalog = readmodelCatalog.table(
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
      foreignColumns: [eserviceInReadmodelCatalog.id],
      name: "eservice_descriptor_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eserviceId, table.metadataVersion],
      foreignColumns: [
        eserviceInReadmodelCatalog.id,
        eserviceInReadmodelCatalog.metadataVersion,
      ],
      name: "eservice_descriptor_eservice_id_metadata_version_fkey",
    }),
  ]
);

export const eserviceDescriptorRejectionReasonInReadmodelCatalog =
  readmodelCatalog.table(
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
        foreignColumns: [eserviceInReadmodelCatalog.id],
        name: "eservice_descriptor_rejection_reason_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptorId],
        foreignColumns: [eserviceDescriptorInReadmodelCatalog.id],
        name: "eservice_descriptor_rejection_reason_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_descriptor_rejection_eservice_id_metadata_version_fkey",
      }),
    ]
  );

export const eserviceDescriptorInterfaceInReadmodelCatalog =
  readmodelCatalog.table(
    "eservice_descriptor_interface",
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
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceId],
        foreignColumns: [eserviceInReadmodelCatalog.id],
        name: "eservice_descriptor_interface_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptorId],
        foreignColumns: [eserviceDescriptorInReadmodelCatalog.id],
        name: "eservice_descriptor_interface_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_descriptor_interface_eservice_id_metadata_version_fkey",
      }),
      unique("eservice_descriptor_interface_descriptor_id_key").on(
        table.descriptorId
      ),
    ]
  );

export const delegationContractDocumentInReadmodelDelegation =
  readmodelDelegation.table(
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
        foreignColumns: [delegationInReadmodelDelegation.id],
        name: "delegation_contract_document_delegation_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.delegationId, table.metadataVersion],
        foreignColumns: [
          delegationInReadmodelDelegation.id,
          delegationInReadmodelDelegation.metadataVersion,
        ],
        name: "delegation_contract_document_delegation_id_metadata_versio_fkey",
      }),
      unique("delegation_contract_document_delegation_id_kind_unique").on(
        table.delegationId,
        table.kind
      ),
    ]
  );

export const eserviceDescriptorDocumentInReadmodelCatalog =
  readmodelCatalog.table(
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
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceId],
        foreignColumns: [eserviceInReadmodelCatalog.id],
        name: "eservice_descriptor_document_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptorId],
        foreignColumns: [eserviceDescriptorInReadmodelCatalog.id],
        name: "eservice_descriptor_document_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_descriptor_document_eservice_id_metadata_version_fkey",
      }),
    ]
  );

export const eserviceRiskAnalysisInReadmodelCatalog = readmodelCatalog.table(
  "eservice_risk_analysis",
  {
    id: uuid().notNull(),
    eserviceId: uuid("eservice_id").notNull(),
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
      foreignColumns: [eserviceInReadmodelCatalog.id],
      name: "eservice_risk_analysis_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eserviceId, table.metadataVersion],
      foreignColumns: [
        eserviceInReadmodelCatalog.id,
        eserviceInReadmodelCatalog.metadataVersion,
      ],
      name: "eservice_risk_analysis_eservice_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.id, table.eserviceId],
      name: "eservice_risk_analysis_pkey",
    }),
    unique("eservice_risk_analysis_risk_analysis_form_id_eservice_id_key").on(
      table.eserviceId,
      table.riskAnalysisFormId
    ),
  ]
);

export const eserviceRiskAnalysisAnswerInReadmodelCatalog =
  readmodelCatalog.table(
    "eservice_risk_analysis_answer",
    {
      id: uuid().notNull(),
      eserviceId: uuid("eservice_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceId],
        foreignColumns: [eserviceInReadmodelCatalog.id],
        name: "eservice_risk_analysis_answer_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_risk_analysis_answer_eservice_id_metadata_version_fkey",
      }),
      foreignKey({
        columns: [table.eserviceId, table.riskAnalysisFormId],
        foreignColumns: [
          eserviceRiskAnalysisInReadmodelCatalog.eserviceId,
          eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
        ],
        name: "eservice_risk_analysis_answer_risk_analysis_form_id_eservi_fkey",
      }).onDelete("cascade"),
      primaryKey({
        columns: [table.id, table.eserviceId],
        name: "eservice_risk_analysis_answer_pkey",
      }),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_risk_analysis_answer_eservice_id_metadata_version_fkey",
      }),
    ]
  );

export const eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template_risk_analysis",
    {
      id: uuid().primaryKey().notNull(),
      eserviceTemplateId: uuid("eservice_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      name: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
      riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
      riskAnalysisFormVersion: varchar("risk_analysis_form_version").notNull(),
      tenantKind: varchar("tenant_kind").notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceTemplateId],
        foreignColumns: [eserviceTemplateInReadmodelEserviceTemplate.id],
        name: "eservice_template_risk_analysis_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceTemplateId, table.metadataVersion],
        foreignColumns: [
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
        ],
        name: "eservice_template_risk_analys_eservice_template_id_metadat_fkey",
      }),
      unique("eservice_template_risk_analysis_risk_analysis_form_id_key").on(
        table.riskAnalysisFormId
      ),
    ]
  );

export const eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template_risk_analysis_answer",
    {
      id: uuid().primaryKey().notNull(),
      eserviceTemplateId: uuid("eservice_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceTemplateId],
        foreignColumns: [eserviceTemplateInReadmodelEserviceTemplate.id],
        name: "eservice_template_risk_analysis_answe_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.riskAnalysisFormId],
        foreignColumns: [
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
        ],
        name: "eservice_template_risk_analysis_answ_risk_analysis_form_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceTemplateId, table.metadataVersion],
        foreignColumns: [
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
        ],
        name: "eservice_template_risk_analy_eservice_template_id_metadat_fkey1",
      }),
    ]
  );

export const purposeInReadmodelPurpose = readmodelPurpose.table(
  "purpose",
  {
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
    purposeTemplateId: uuid("purpose_template_id"),
  },
  (table) => [
    unique("purpose_id_metadata_version_unique").on(
      table.id,
      table.metadataVersion
    ),
  ]
);

export const purposeRiskAnalysisFormInReadmodelPurpose = readmodelPurpose.table(
  "purpose_risk_analysis_form",
  {
    id: uuid().notNull(),
    purposeId: uuid("purpose_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    version: varchar().notNull(),
    riskAnalysisId: uuid("risk_analysis_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodelPurpose.id],
      name: "purpose_risk_analysis_form_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeId, table.metadataVersion],
      foreignColumns: [
        purposeInReadmodelPurpose.id,
        purposeInReadmodelPurpose.metadataVersion,
      ],
      name: "purpose_risk_analysis_form_purpose_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.id, table.purposeId],
      name: "purpose_risk_analysis_form_pkey",
    }),
  ]
);

export const purposeRiskAnalysisAnswerInReadmodelPurpose =
  readmodelPurpose.table(
    "purpose_risk_analysis_answer",
    {
      id: uuid().notNull(),
      purposeId: uuid("purpose_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeId],
        foreignColumns: [purposeInReadmodelPurpose.id],
        name: "purpose_risk_analysis_answer_purpose_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeId, table.riskAnalysisFormId],
        foreignColumns: [
          purposeRiskAnalysisFormInReadmodelPurpose.id,
          purposeRiskAnalysisFormInReadmodelPurpose.purposeId,
        ],
        name: "purpose_risk_analysis_answer_risk_analysis_form_id_purpose_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeId, table.metadataVersion],
        foreignColumns: [
          purposeInReadmodelPurpose.id,
          purposeInReadmodelPurpose.metadataVersion,
        ],
        name: "purpose_risk_analysis_answer_purpose_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.id, table.purposeId],
        name: "purpose_risk_analysis_answer_pkey",
      }),
    ]
  );

export const clientInReadmodelClient = readmodelClient.table(
  "client",
  {
    id: uuid().primaryKey().notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    consumerId: uuid("consumer_id").notNull(),
    adminId: uuid("admin_id"),
    name: varchar().notNull(),
    description: varchar(),
    kind: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    unique("client_id_metadata_version_unique").on(
      table.id,
      table.metadataVersion
    ),
  ]
);

export const purposeVersionInReadmodelPurpose = readmodelPurpose.table(
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
      foreignColumns: [purposeInReadmodelPurpose.id],
      name: "purpose_version_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeId, table.metadataVersion],
      foreignColumns: [
        purposeInReadmodelPurpose.id,
        purposeInReadmodelPurpose.metadataVersion,
      ],
      name: "purpose_version_purpose_id_metadata_version_fkey",
    }),
  ]
);

export const purposeVersionDocumentInReadmodelPurpose = readmodelPurpose.table(
  "purpose_version_document",
  {
    purposeId: uuid("purpose_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    purposeVersionId: uuid("purpose_version_id").notNull(),
    id: uuid().notNull(),
    contentType: varchar("content_type").notNull(),
    path: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodelPurpose.id],
      name: "purpose_version_document_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeVersionId],
      foreignColumns: [purposeVersionInReadmodelPurpose.id],
      name: "purpose_version_document_purpose_version_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeId, table.metadataVersion],
      foreignColumns: [
        purposeInReadmodelPurpose.id,
        purposeInReadmodelPurpose.metadataVersion,
      ],
      name: "purpose_version_document_purpose_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.purposeVersionId, table.id],
      name: "purpose_version_document_pkey",
    }),
    unique("purpose_version_document_purpose_version_id_key").on(
      table.purposeVersionId
    ),
  ]
);

export const purposeVersionStampInReadmodelPurpose = readmodelPurpose.table(
  "purpose_version_stamp",
  {
    purposeId: uuid("purpose_id").notNull(),
    purposeVersionId: uuid("purpose_version_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    who: uuid().notNull(),
    when: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.purposeId],
      foreignColumns: [purposeInReadmodelPurpose.id],
      name: "purpose_version_stamp_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeVersionId],
      foreignColumns: [purposeVersionInReadmodelPurpose.id],
      name: "purpose_version_stamp_purpose_version_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purposeId, table.metadataVersion],
      foreignColumns: [
        purposeInReadmodelPurpose.id,
        purposeInReadmodelPurpose.metadataVersion,
      ],
      name: "purpose_version_stamp_purpose_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.purposeVersionId, table.kind],
      name: "purpose_version_stamp_pkey",
    }),
  ]
);

export const tenantInReadmodelTenant = readmodelTenant.table(
  "tenant",
  {
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
  },
  (table) => [
    unique("tenant_id_metadata_version_unique").on(
      table.id,
      table.metadataVersion
    ),
  ]
);

export const tenantMailInReadmodelTenant = readmodelTenant.table(
  "tenant_mail",
  {
    id: varchar().notNull(),
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    kind: varchar().notNull(),
    address: varchar().notNull(),
    description: varchar(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodelTenant.id],
      name: "tenant_mail_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.metadataVersion],
      foreignColumns: [
        tenantInReadmodelTenant.id,
        tenantInReadmodelTenant.metadataVersion,
      ],
      name: "tenant_mail_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.id, table.tenantId, table.createdAt],
      name: "tenant_mail_pkey",
    }),
  ]
);

export const producerKeychainUserInReadmodelProducerKeychain =
  readmodelProducerKeychain.table(
    "producer_keychain_user",
    {
      metadataVersion: integer("metadata_version").notNull(),
      producerKeychainId: uuid("producer_keychain_id").notNull(),
      userId: uuid("user_id").notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.producerKeychainId],
        foreignColumns: [producerKeychainInReadmodelProducerKeychain.id],
        name: "producer_keychain_user_producer_keychain_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadataVersion, table.producerKeychainId],
        foreignColumns: [
          producerKeychainInReadmodelProducerKeychain.id,
          producerKeychainInReadmodelProducerKeychain.metadataVersion,
        ],
        name: "producer_keychain_user_producer_keychain_id_metadata_versi_fkey",
      }),
      primaryKey({
        columns: [table.producerKeychainId, table.userId],
        name: "producer_keychain_user_pkey",
      }),
    ]
  );

export const producerKeychainEserviceInReadmodelProducerKeychain =
  readmodelProducerKeychain.table(
    "producer_keychain_eservice",
    {
      metadataVersion: integer("metadata_version").notNull(),
      producerKeychainId: uuid("producer_keychain_id").notNull(),
      eserviceId: uuid("eservice_id").notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.producerKeychainId],
        foreignColumns: [producerKeychainInReadmodelProducerKeychain.id],
        name: "producer_keychain_eservice_producer_keychain_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadataVersion, table.producerKeychainId],
        foreignColumns: [
          producerKeychainInReadmodelProducerKeychain.id,
          producerKeychainInReadmodelProducerKeychain.metadataVersion,
        ],
        name: "producer_keychain_eservice_producer_keychain_id_metadata_v_fkey",
      }),
      primaryKey({
        columns: [table.producerKeychainId, table.eserviceId],
        name: "producer_keychain_eservice_pkey",
      }),
    ]
  );

export const clientUserInReadmodelClient = readmodelClient.table(
  "client_user",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clientInReadmodelClient.id],
      name: "client_user_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metadataVersion, table.clientId],
      foreignColumns: [
        clientInReadmodelClient.id,
        clientInReadmodelClient.metadataVersion,
      ],
      name: "client_user_client_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.clientId, table.userId],
      name: "client_user_pkey",
    }),
  ]
);

export const clientPurposeInReadmodelClient = readmodelClient.table(
  "client_purpose",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
    purposeId: uuid("purpose_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clientInReadmodelClient.id],
      name: "client_purpose_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metadataVersion, table.clientId],
      foreignColumns: [
        clientInReadmodelClient.id,
        clientInReadmodelClient.metadataVersion,
      ],
      name: "client_purpose_client_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.clientId, table.purposeId],
      name: "client_purpose_pkey",
    }),
  ]
);

export const agreementAttributeInReadmodelAgreement = readmodelAgreement.table(
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
      foreignColumns: [agreementInReadmodelAgreement.id],
      name: "agreement_attribute_agreement_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agreementId, table.metadataVersion],
      foreignColumns: [
        agreementInReadmodelAgreement.id,
        agreementInReadmodelAgreement.metadataVersion,
      ],
      name: "agreement_attribute_agreement_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.agreementId, table.attributeId],
      name: "agreement_attribute_pkey",
    }),
  ]
);

export const tenantVerifiedAttributeInReadmodelTenant = readmodelTenant.table(
  "tenant_verified_attribute",
  {
    attributeId: uuid("attribute_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    assignmentTimestamp: timestamp("assignment_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodelTenant.id],
      name: "tenant_verified_attribute_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.metadataVersion],
      foreignColumns: [
        tenantInReadmodelTenant.id,
        tenantInReadmodelTenant.metadataVersion,
      ],
      name: "tenant_verified_attribute_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.attributeId, table.tenantId],
      name: "tenant_verified_attribute_pkey",
    }),
  ]
);

export const delegationStampInReadmodelDelegation = readmodelDelegation.table(
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
      foreignColumns: [delegationInReadmodelDelegation.id],
      name: "delegation_stamp_delegation_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.delegationId, table.metadataVersion],
      foreignColumns: [
        delegationInReadmodelDelegation.id,
        delegationInReadmodelDelegation.metadataVersion,
      ],
      name: "delegation_stamp_delegation_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.delegationId, table.kind],
      name: "delegation_stamp_pkey",
    }),
  ]
);

export const tenantFeatureInReadmodelTenant = readmodelTenant.table(
  "tenant_feature",
  {
    tenantId: uuid("tenant_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    kind: varchar().notNull(),
    certifierId: varchar("certifier_id"),
    availabilityTimestamp: timestamp("availability_timestamp", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodelTenant.id],
      name: "tenant_feature_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.metadataVersion],
      foreignColumns: [
        tenantInReadmodelTenant.id,
        tenantInReadmodelTenant.metadataVersion,
      ],
      name: "tenant_feature_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.tenantId, table.kind],
      name: "tenant_feature_pkey",
    }),
  ]
);

export const tenantCertifiedAttributeInReadmodelTenant = readmodelTenant.table(
  "tenant_certified_attribute",
  {
    attributeId: uuid("attribute_id").notNull(),
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
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodelTenant.id],
      name: "tenant_certified_attribute_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.metadataVersion],
      foreignColumns: [
        tenantInReadmodelTenant.id,
        tenantInReadmodelTenant.metadataVersion,
      ],
      name: "tenant_certified_attribute_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.attributeId, table.tenantId],
      name: "tenant_certified_attribute_pkey",
    }),
  ]
);

export const agreementStampInReadmodelAgreement = readmodelAgreement.table(
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
      foreignColumns: [agreementInReadmodelAgreement.id],
      name: "agreement_stamp_agreement_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agreementId, table.metadataVersion],
      foreignColumns: [
        agreementInReadmodelAgreement.id,
        agreementInReadmodelAgreement.metadataVersion,
      ],
      name: "agreement_stamp_agreement_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.agreementId, table.kind],
      name: "agreement_stamp_pkey",
    }),
  ]
);

export const tenantDeclaredAttributeInReadmodelTenant = readmodelTenant.table(
  "tenant_declared_attribute",
  {
    attributeId: uuid("attribute_id").notNull(),
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
    delegationId: uuid("delegation_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenantInReadmodelTenant.id],
      name: "tenant_declared_attribute_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.metadataVersion],
      foreignColumns: [
        tenantInReadmodelTenant.id,
        tenantInReadmodelTenant.metadataVersion,
      ],
      name: "tenant_declared_attribute_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.attributeId, table.tenantId],
      name: "tenant_declared_attribute_pkey",
    }),
  ]
);

export const eserviceDescriptorAttributeInReadmodelCatalog =
  readmodelCatalog.table(
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
        foreignColumns: [eserviceInReadmodelCatalog.id],
        name: "eservice_descriptor_attribute_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptorId],
        foreignColumns: [eserviceDescriptorInReadmodelCatalog.id],
        name: "eservice_descriptor_attribute_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_descriptor_attribute_eservice_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.attributeId, table.descriptorId, table.groupId],
        name: "eservice_descriptor_attribute_pkey",
      }),
    ]
  );

export const eserviceTemplateVersionAttributeInReadmodelEserviceTemplate =
  readmodelEserviceTemplate.table(
    "eservice_template_version_attribute",
    {
      attributeId: uuid("attribute_id").notNull(),
      eserviceTemplateId: uuid("eservice_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      versionId: uuid("version_id").notNull(),
      explicitAttributeVerification: boolean(
        "explicit_attribute_verification"
      ).notNull(),
      kind: varchar().notNull(),
      groupId: integer("group_id").notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceTemplateId],
        foreignColumns: [eserviceTemplateInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_attribute_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.versionId],
        foreignColumns: [eserviceTemplateVersionInReadmodelEserviceTemplate.id],
        name: "eservice_template_version_attribute_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceTemplateId, table.metadataVersion],
        foreignColumns: [
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.metadataVersion,
        ],
        name: "eservice_template_version_att_eservice_template_id_metadat_fkey",
      }),
      primaryKey({
        columns: [table.attributeId, table.versionId, table.groupId],
        name: "eservice_template_version_attribute_pkey",
      }),
    ]
  );

export const eserviceDescriptorTemplateVersionRefInReadmodelCatalog =
  readmodelCatalog.table(
    "eservice_descriptor_template_version_ref",
    {
      eserviceTemplateVersionId: uuid("eservice_template_version_id").notNull(),
      eserviceId: uuid("eservice_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      descriptorId: uuid("descriptor_id").notNull(),
      contactName: varchar("contact_name"),
      contactEmail: varchar("contact_email"),
      contactUrl: varchar("contact_url"),
      termsAndConditionsUrl: varchar("terms_and_conditions_url"),
    },
    (table) => [
      foreignKey({
        columns: [table.eserviceId],
        foreignColumns: [eserviceInReadmodelCatalog.id],
        name: "eservice_descriptor_template_version_ref_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptorId],
        foreignColumns: [eserviceDescriptorInReadmodelCatalog.id],
        name: "eservice_descriptor_template_version_ref_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eserviceId, table.metadataVersion],
        foreignColumns: [
          eserviceInReadmodelCatalog.id,
          eserviceInReadmodelCatalog.metadataVersion,
        ],
        name: "eservice_descriptor_template__eservice_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.eserviceTemplateVersionId, table.descriptorId],
        name: "eservice_descriptor_template_version_ref_pkey",
      }),
    ]
  );

export const clientJwkKeyInReadmodelClientJwkKey = readmodelClientJwkKey.table(
  "client_jwk_key",
  {
    clientId: uuid("client_id").notNull(),
    metadataVersion: integer("metadata_version").notNull(),
    alg: varchar().notNull(),
    e: varchar().notNull(),
    kid: varchar().notNull(),
    kty: varchar().notNull(),
    n: varchar().notNull(),
    use: varchar().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.clientId, table.kid],
      name: "client_jwk_key_pkey",
    }),
  ]
);

export const producerJwkKeyInReadmodelProducerJwkKey =
  readmodelProducerJwkKey.table(
    "producer_jwk_key",
    {
      producerKeychainId: uuid("producer_keychain_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      alg: varchar().notNull(),
      e: varchar().notNull(),
      kid: varchar().notNull(),
      kty: varchar().notNull(),
      n: varchar().notNull(),
      use: varchar().notNull(),
    },
    (table) => [
      primaryKey({
        columns: [table.producerKeychainId, table.kid],
        name: "producer_jwk_key_pkey",
      }),
    ]
  );

export const tenantVerifiedAttributeVerifierInReadmodelTenant =
  readmodelTenant.table(
    "tenant_verified_attribute_verifier",
    {
      tenantId: uuid("tenant_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      tenantVerifierId: uuid("tenant_verifier_id").notNull(),
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
        foreignColumns: [tenantInReadmodelTenant.id],
        name: "tenant_verified_attribute_verifier_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenantVerifierId],
        foreignColumns: [tenantInReadmodelTenant.id],
        name: "tenant_verified_attribute_verifier_tenant_verifier_id_fkey",
      }),
      foreignKey({
        columns: [table.tenantId, table.tenantVerifiedAttributeId],
        foreignColumns: [
          tenantVerifiedAttributeInReadmodelTenant.attributeId,
          tenantVerifiedAttributeInReadmodelTenant.tenantId,
        ],
        name: "tenant_verified_attribute_ver_tenant_id_tenant_verified_at_fkey",
      }),
      foreignKey({
        columns: [table.tenantId, table.metadataVersion],
        foreignColumns: [
          tenantInReadmodelTenant.id,
          tenantInReadmodelTenant.metadataVersion,
        ],
        name: "tenant_verified_attribute_verif_tenant_id_metadata_version_fkey",
      }),
    ]
  );

export const clientKeyInReadmodelClient = readmodelClient.table(
  "client_key",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id"),
    kid: varchar().notNull(),
    name: varchar().notNull(),
    encodedPem: varchar("encoded_pem").notNull(),
    algorithm: varchar().notNull(),
    use: varchar().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clientInReadmodelClient.id],
      name: "client_key_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metadataVersion, table.clientId],
      foreignColumns: [
        clientInReadmodelClient.id,
        clientInReadmodelClient.metadataVersion,
      ],
      name: "client_key_client_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.clientId, table.kid],
      name: "client_key_pkey",
    }),
  ]
);

export const producerKeychainKeyInReadmodelProducerKeychain =
  readmodelProducerKeychain.table(
    "producer_keychain_key",
    {
      metadataVersion: integer("metadata_version").notNull(),
      producerKeychainId: uuid("producer_keychain_id").notNull(),
      userId: uuid("user_id").notNull(),
      kid: varchar().notNull(),
      name: varchar().notNull(),
      encodedPem: varchar("encoded_pem").notNull(),
      algorithm: varchar().notNull(),
      use: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.producerKeychainId],
        foreignColumns: [producerKeychainInReadmodelProducerKeychain.id],
        name: "producer_keychain_key_producer_keychain_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadataVersion, table.producerKeychainId],
        foreignColumns: [
          producerKeychainInReadmodelProducerKeychain.id,
          producerKeychainInReadmodelProducerKeychain.metadataVersion,
        ],
        name: "producer_keychain_key_producer_keychain_id_metadata_versio_fkey",
      }),
      primaryKey({
        columns: [table.producerKeychainId, table.kid],
        name: "producer_keychain_key_pkey",
      }),
    ]
  );

export const tenantVerifiedAttributeRevokerInReadmodelTenant =
  readmodelTenant.table(
    "tenant_verified_attribute_revoker",
    {
      tenantId: uuid("tenant_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      tenantRevokerId: uuid("tenant_revoker_id").notNull(),
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
      revocationDate: timestamp("revocation_date", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
      delegationId: uuid("delegation_id"),
    },
    (table) => [
      foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenantInReadmodelTenant.id],
        name: "tenant_verified_attribute_revoker_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenantRevokerId],
        foreignColumns: [tenantInReadmodelTenant.id],
        name: "tenant_verified_attribute_revoker_tenant_revoker_id_fkey",
      }),
      foreignKey({
        columns: [table.tenantId, table.tenantVerifiedAttributeId],
        foreignColumns: [
          tenantVerifiedAttributeInReadmodelTenant.attributeId,
          tenantVerifiedAttributeInReadmodelTenant.tenantId,
        ],
        name: "tenant_verified_attribute_rev_tenant_id_tenant_verified_at_fkey",
      }),
      foreignKey({
        columns: [table.tenantId, table.metadataVersion],
        foreignColumns: [
          tenantInReadmodelTenant.id,
          tenantInReadmodelTenant.metadataVersion,
        ],
        name: "tenant_verified_attribute_revok_tenant_id_metadata_version_fkey",
      }),
    ]
  );

export const tenantNotificationConfigInReadmodelNotificationConfig =
  readmodelNotificationConfig.table(
    "tenant_notification_config",
    {
      id: uuid().primaryKey().notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      tenantId: uuid("tenant_id").notNull(),
      enabled: boolean().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
      updatedAt: timestamp("updated_at", {
        withTimezone: true,
        mode: "string",
      }),
    },
    (table) => [
      unique("tenant_notification_config_id_metadata_version_unique").on(
        table.id,
        table.metadataVersion
      ),
      unique("tenant_notification_config_tenant_id_unique").on(table.tenantId),
    ]
  );

export const userNotificationConfigInReadmodelNotificationConfig =
  readmodelNotificationConfig.table(
    "user_notification_config",
    {
      id: uuid().primaryKey().notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      userId: uuid("user_id").notNull(),
      tenantId: uuid("tenant_id").notNull(),
      userRoles: varchar("user_roles").array().notNull(),
      inAppNotificationPreference: boolean(
        "in_app_notification_preference"
      ).notNull(),
      emailNotificationPreference: varchar(
        "email_notification_preference"
      ).notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
      updatedAt: timestamp("updated_at", {
        withTimezone: true,
        mode: "string",
      }),
    },
    (table) => [
      unique("user_notification_config_id_metadata_version_unique").on(
        table.id,
        table.metadataVersion
      ),
      unique("user_notification_config_user_id_tenant_id_unique").on(
        table.userId,
        table.tenantId
      ),
    ]
  );

export const userEnabledInAppNotificationInReadmodelNotificationConfig =
  readmodelNotificationConfig.table(
    "user_enabled_in_app_notification",
    {
      userNotificationConfigId: uuid("user_notification_config_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      notificationType: varchar("notification_type").notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.userNotificationConfigId],
        foreignColumns: [
          userNotificationConfigInReadmodelNotificationConfig.id,
        ],
        name: "user_enabled_in_app_notificati_user_notification_config_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.userNotificationConfigId, table.metadataVersion],
        foreignColumns: [
          userNotificationConfigInReadmodelNotificationConfig.id,
          userNotificationConfigInReadmodelNotificationConfig.metadataVersion,
        ],
        name: "user_enabled_in_app_notificat_user_notification_config_id__fkey",
      }),
      primaryKey({
        columns: [table.userNotificationConfigId, table.notificationType],
        name: "user_enabled_in_app_notification_pkey",
      }),
    ]
  );

export const userEnabledEmailNotificationInReadmodelNotificationConfig =
  readmodelNotificationConfig.table(
    "user_enabled_email_notification",
    {
      userNotificationConfigId: uuid("user_notification_config_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      notificationType: varchar("notification_type").notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.userNotificationConfigId],
        foreignColumns: [
          userNotificationConfigInReadmodelNotificationConfig.id,
        ],
        name: "user_enabled_email_notificatio_user_notification_config_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.userNotificationConfigId, table.metadataVersion],
        foreignColumns: [
          userNotificationConfigInReadmodelNotificationConfig.id,
          userNotificationConfigInReadmodelNotificationConfig.metadataVersion,
        ],
        name: "user_enabled_email_notificati_user_notification_config_id__fkey",
      }),
      primaryKey({
        columns: [table.userNotificationConfigId, table.notificationType],
        name: "user_enabled_email_notification_pkey",
      }),
    ]
  );

export const purposeTemplateInReadmodelPurposeTemplate =
  readmodelPurposeTemplate.table(
    "purpose_template",
    {
      id: uuid().primaryKey().notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      targetDescription: varchar("target_description").notNull(),
      targetTenantKind: varchar("target_tenant_kind").notNull(),
      creatorId: uuid("creator_id").notNull(),
      state: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
      updatedAt: timestamp("updated_at", {
        withTimezone: true,
        mode: "string",
      }),
      purposeTitle: varchar("purpose_title").notNull(),
      purposeDescription: varchar("purpose_description").notNull(),
      purposeIsFreeOfCharge: boolean("purpose_is_free_of_charge").notNull(),
      purposeFreeOfChargeReason: varchar("purpose_free_of_charge_reason"),
      purposeDailyCalls: integer("purpose_daily_calls"),
    },
    (table) => [
      unique("purpose_template_id_metadata_version_key").on(
        table.id,
        table.metadataVersion
      ),
    ]
  );

export const purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate =
  readmodelPurposeTemplate.table(
    "purpose_template_risk_analysis_form",
    {
      id: uuid().primaryKey().notNull(),
      purposeTemplateId: uuid("purpose_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      version: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeTemplateId],
        foreignColumns: [purposeTemplateInReadmodelPurposeTemplate.id],
        name: "purpose_template_risk_analysis_form_purpose_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeTemplateId, table.metadataVersion],
        foreignColumns: [
          purposeTemplateInReadmodelPurposeTemplate.id,
          purposeTemplateInReadmodelPurposeTemplate.metadataVersion,
        ],
        name: "purpose_template_risk_analysi_purpose_template_id_metadata_fkey",
      }),
      unique("purpose_template_risk_analysis_form_purpose_template_id_key").on(
        table.purposeTemplateId
      ),
    ]
  );

export const purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate =
  readmodelPurposeTemplate.table(
    "purpose_template_risk_analysis_answer",
    {
      id: uuid().primaryKey().notNull(),
      purposeTemplateId: uuid("purpose_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array().notNull(),
      editable: boolean().notNull(),
      suggestedValues: varchar("suggested_values").array(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeTemplateId],
        foreignColumns: [purposeTemplateInReadmodelPurposeTemplate.id],
        name: "purpose_template_risk_analysis_answer_purpose_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.riskAnalysisFormId],
        foreignColumns: [
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
        ],
        name: "purpose_template_risk_analysis_answe_risk_analysis_form_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeTemplateId, table.metadataVersion],
        foreignColumns: [
          purposeTemplateInReadmodelPurposeTemplate.id,
          purposeTemplateInReadmodelPurposeTemplate.metadataVersion,
        ],
        name: "purpose_template_risk_analys_purpose_template_id_metadata_fkey1",
      }),
    ]
  );

export const purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate =
  readmodelPurposeTemplate.table(
    "purpose_template_risk_analysis_answer_annotation_document",
    {
      id: uuid().primaryKey().notNull(),
      purposeTemplateId: uuid("purpose_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      annotationId: uuid("annotation_id").notNull(),
      name: varchar().notNull(),
      prettyName: varchar("pretty_name").notNull(),
      contentType: varchar("content_type").notNull(),
      path: varchar().notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeTemplateId],
        foreignColumns: [purposeTemplateInReadmodelPurposeTemplate.id],
        name: "purpose_template_risk_analysis_answer_purpose_template_id_fkey1",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.annotationId],
        foreignColumns: [
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
        ],
        name: "purpose_template_risk_analysis_answer_annota_annotation_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeTemplateId, table.metadataVersion],
        foreignColumns: [
          purposeTemplateInReadmodelPurposeTemplate.id,
          purposeTemplateInReadmodelPurposeTemplate.metadataVersion,
        ],
        name: "purpose_template_risk_analys_purpose_template_id_metadata_fkey3",
      }),
    ]
  );

export const purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate =
  readmodelPurposeTemplate.table(
    "purpose_template_risk_analysis_answer_annotation",
    {
      id: uuid().primaryKey().notNull(),
      purposeTemplateId: uuid("purpose_template_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      answerId: uuid("answer_id").notNull(),
      text: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeTemplateId],
        foreignColumns: [purposeTemplateInReadmodelPurposeTemplate.id],
        name: "purpose_template_risk_analysis_answer__purpose_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.answerId],
        foreignColumns: [
          purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
        ],
        name: "purpose_template_risk_analysis_answer_annotation_answer_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeTemplateId, table.metadataVersion],
        foreignColumns: [
          purposeTemplateInReadmodelPurposeTemplate.id,
          purposeTemplateInReadmodelPurposeTemplate.metadataVersion,
        ],
        name: "purpose_template_risk_analys_purpose_template_id_metadata_fkey2",
      }),
      unique(
        "purpose_template_risk_analysis_answer_annotation_answer_id_key"
      ).on(table.answerId),
    ]
  );

export const purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate =
  readmodelPurposeTemplate.table(
    "purpose_template_eservice_descriptor",
    {
      metadataVersion: integer("metadata_version").notNull(),
      purposeTemplateId: uuid("purpose_template_id").notNull(),
      eserviceId: uuid("eservice_id").notNull(),
      descriptorId: uuid("descriptor_id").notNull(),
      createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeTemplateId],
        foreignColumns: [purposeTemplateInReadmodelPurposeTemplate.id],
        name: "purpose_template_eservice_descriptor_purpose_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadataVersion, table.purposeTemplateId],
        foreignColumns: [
          purposeTemplateInReadmodelPurposeTemplate.id,
          purposeTemplateInReadmodelPurposeTemplate.metadataVersion,
        ],
        name: "purpose_template_eservice_des_purpose_template_id_metadata_fkey",
      }),
      primaryKey({
        columns: [table.purposeTemplateId, table.eserviceId],
        name: "purpose_template_eservice_descriptor_pkey",
      }),
    ]
  );
