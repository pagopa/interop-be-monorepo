import {
  pgSchema,
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

export const readmodelAgreement = pgSchema("readmodel_agreement");
export const readmodelProducerKeychain = pgSchema(
  "readmodel_producer_keychain"
);
export const readmodelClient = pgSchema("readmodel_client");
export const readmodelAttribute = pgSchema("readmodel_attribute");
export const readmodelDelegation = pgSchema("readmodel_delegation");
export const readmodelCatalog = pgSchema("readmodel_catalog");
export const readmodelPurpose = pgSchema("readmodel_purpose");
export const readmodelClientJwkKey = pgSchema("readmodel_client_jwk_key");
export const readmodelProducerJwkKey = pgSchema("readmodel_producer_jwk_key");
export const readmodelTenant = pgSchema("readmodel_tenant");

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
    unique("agreement_contract_agreement_id_key").on(table.agreementId),
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
    id: uuid().primaryKey().notNull(),
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
    unique("eservice_risk_analysis_risk_analysis_form_id_key").on(
      table.riskAnalysisFormId
    ),
  ]
);

export const eserviceRiskAnalysisAnswerInReadmodelCatalog =
  readmodelCatalog.table(
    "eservice_risk_analysis_answer",
    {
      id: uuid().primaryKey().notNull(),
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
        columns: [table.riskAnalysisFormId],
        foreignColumns: [
          eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
        ],
        name: "eservice_risk_analysis_answer_risk_analysis_form_id_fkey",
      }).onDelete("cascade"),
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
    id: uuid().primaryKey().notNull(),
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
  ]
);

export const purposeRiskAnalysisAnswerInReadmodelPurpose =
  readmodelPurpose.table(
    "purpose_risk_analysis_answer",
    {
      id: uuid().primaryKey().notNull(),
      purposeId: uuid("purpose_id").notNull(),
      metadataVersion: integer("metadata_version").notNull(),
      riskAnalysisFormId: uuid("risk_analysis_form_id").notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array(),
    },
    (table) => [
      foreignKey({
        columns: [table.purposeId],
        foreignColumns: [purposeInReadmodelPurpose.id],
        name: "purpose_risk_analysis_answer_purpose_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.riskAnalysisFormId],
        foreignColumns: [purposeRiskAnalysisFormInReadmodelPurpose.id],
        name: "purpose_risk_analysis_answer_risk_analysis_form_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purposeId, table.metadataVersion],
        foreignColumns: [
          purposeInReadmodelPurpose.id,
          purposeInReadmodelPurpose.metadataVersion,
        ],
        name: "purpose_risk_analysis_answer_purpose_id_metadata_version_fkey",
      }),
    ]
  );

export const clientInReadmodelClient = readmodelClient.table(
  "client",
  {
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
    id: uuid().primaryKey().notNull(),
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
    unique("purpose_version_document_purpose_id_key").on(table.purposeId),
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
      columns: [table.id, table.tenantId],
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
      primaryKey({
        columns: [
          table.tenantId,
          table.tenantVerifierId,
          table.tenantVerifiedAttributeId,
        ],
        name: "tenant_verified_attribute_verifier_pkey",
      }),
    ]
  );

export const clientKeyInReadmodelClient = readmodelClient.table(
  "client_key",
  {
    metadataVersion: integer("metadata_version").notNull(),
    clientId: uuid("client_id").notNull(),
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
      primaryKey({
        columns: [
          table.tenantId,
          table.tenantRevokerId,
          table.tenantVerifiedAttributeId,
        ],
        name: "tenant_verified_attribute_revoker_pkey",
      }),
    ]
  );
