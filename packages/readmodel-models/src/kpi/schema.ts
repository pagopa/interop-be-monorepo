import {
  pgSchema,
  unique,
  uuid,
  integer,
  varchar,
  timestamp,
  foreignKey,
  primaryKey,
  // eslint-disable-next-line id-blacklist
  boolean,
} from "drizzle-orm/pg-core";

export const readmodel_eservice_template = pgSchema(
  "readmodel_eservice_template"
);
export const readmodel_agreement = pgSchema("readmodel_agreement");
export const readmodel_client = pgSchema("readmodel_client");
export const readmodel_attribute = pgSchema("readmodel_attribute");
export const readmodel_delegation = pgSchema("readmodel_delegation");
export const readmodel_catalog = pgSchema("readmodel_catalog");
export const readmodel_client_jwk_key = pgSchema("readmodel_client_jwk_key");
export const readmodel_purpose = pgSchema("readmodel_purpose");
export const readmodel_producer_jwk_key = pgSchema(
  "readmodel_producer_jwk_key"
);
export const readmodel_producer_keychain = pgSchema(
  "readmodel_producer_keychain"
);
export const readmodel_tenant = pgSchema("readmodel_tenant");

export const agreementInReadmodel_agreement = readmodel_agreement.table(
  "agreement",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    eservice_id: uuid().notNull(),
    descriptor_id: uuid().notNull(),
    producer_id: uuid().notNull(),
    consumer_id: uuid().notNull(),
    state: varchar().notNull(),
    suspended_by_consumer: boolean(),
    suspended_by_producer: boolean(),
    suspended_by_platform: boolean(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    updated_at: timestamp({ withTimezone: true, mode: "string" }),
    consumer_notes: varchar(),
    rejection_reason: varchar(),
    suspended_at: timestamp({ withTimezone: true, mode: "string" }),
  },
  (table) => [
    unique("agreement_id_metadata_version_unique").on(
      table.id,
      table.metadata_version
    ),
  ]
);

export const eservice_templateInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template",
    {
      id: uuid().primaryKey().notNull(),
      metadata_version: integer().notNull(),
      creator_id: uuid().notNull(),
      name: varchar().notNull(),
      intended_target: varchar().notNull(),
      description: varchar().notNull(),
      technology: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
      mode: varchar().notNull(),
      is_signal_hub_enabled: boolean(),
    },
    (table) => [
      unique("eservice_template_id_metadata_version_unique").on(
        table.id,
        table.metadata_version
      ),
    ]
  );

export const eservice_template_versionInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template_version",
    {
      id: uuid().primaryKey().notNull(),
      eservice_template_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      version: integer().notNull(),
      description: varchar(),
      state: varchar().notNull(),
      voucher_lifespan: integer().notNull(),
      daily_calls_per_consumer: integer(),
      daily_calls_total: integer(),
      agreement_approval_policy: varchar(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
      published_at: timestamp({ withTimezone: true, mode: "string" }),
      suspended_at: timestamp({ withTimezone: true, mode: "string" }),
      deprecated_at: timestamp({ withTimezone: true, mode: "string" }),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_template_id],
        foreignColumns: [eservice_templateInReadmodel_eservice_template.id],
        name: "eservice_template_version_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_template_id, table.metadata_version],
        foreignColumns: [
          eservice_templateInReadmodel_eservice_template.id,
          eservice_templateInReadmodel_eservice_template.metadata_version,
        ],
        name: "eservice_template_version_eservice_template_id_metadata_ve_fkey",
      }),
    ]
  );

export const agreement_consumer_documentInReadmodel_agreement =
  readmodel_agreement.table(
    "agreement_consumer_document",
    {
      id: uuid().primaryKey().notNull(),
      agreement_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      name: varchar().notNull(),
      pretty_name: varchar().notNull(),
      content_type: varchar().notNull(),
      path: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.agreement_id],
        foreignColumns: [agreementInReadmodel_agreement.id],
        name: "agreement_consumer_document_agreement_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.agreement_id, table.metadata_version],
        foreignColumns: [
          agreementInReadmodel_agreement.id,
          agreementInReadmodel_agreement.metadata_version,
        ],
        name: "agreement_consumer_document_agreement_id_metadata_version_fkey",
      }),
    ]
  );

export const eservice_template_version_interfaceInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template_version_interface",
    {
      id: uuid().primaryKey().notNull(),
      eservice_template_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      version_id: uuid().notNull(),
      name: varchar().notNull(),
      content_type: varchar().notNull(),
      pretty_name: varchar().notNull(),
      path: varchar().notNull(),
      checksum: varchar().notNull(),
      upload_date: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_template_id],
        foreignColumns: [eservice_templateInReadmodel_eservice_template.id],
        name: "eservice_template_version_interface_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.version_id],
        foreignColumns: [
          eservice_template_versionInReadmodel_eservice_template.id,
        ],
        name: "eservice_template_version_interface_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_template_id, table.metadata_version],
        foreignColumns: [
          eservice_templateInReadmodel_eservice_template.id,
          eservice_templateInReadmodel_eservice_template.metadata_version,
        ],
        name: "eservice_template_version_int_eservice_template_id_metadat_fkey",
      }),
      unique("eservice_template_version_interface_version_id_key").on(
        table.version_id
      ),
    ]
  );

export const eservice_template_version_documentInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template_version_document",
    {
      id: uuid().primaryKey().notNull(),
      eservice_template_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      version_id: uuid().notNull(),
      name: varchar().notNull(),
      content_type: varchar().notNull(),
      pretty_name: varchar().notNull(),
      path: varchar().notNull(),
      checksum: varchar().notNull(),
      upload_date: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_template_id],
        foreignColumns: [eservice_templateInReadmodel_eservice_template.id],
        name: "eservice_template_version_document_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.version_id],
        foreignColumns: [
          eservice_template_versionInReadmodel_eservice_template.id,
        ],
        name: "eservice_template_version_document_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_template_id, table.metadata_version],
        foreignColumns: [
          eservice_templateInReadmodel_eservice_template.id,
          eservice_templateInReadmodel_eservice_template.metadata_version,
        ],
        name: "eservice_template_version_doc_eservice_template_id_metadat_fkey",
      }),
    ]
  );

export const attributeInReadmodel_attribute = readmodel_attribute.table(
  "attribute",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    code: varchar(),
    kind: varchar().notNull(),
    description: varchar().notNull(),
    origin: varchar(),
    name: varchar().notNull(),
    creation_time: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  }
);

export const delegationInReadmodel_delegation = readmodel_delegation.table(
  "delegation",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    delegator_id: uuid().notNull(),
    delegate_id: uuid().notNull(),
    eservice_id: uuid().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    updated_at: timestamp({ withTimezone: true, mode: "string" }),
    rejection_reason: varchar(),
    state: varchar().notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    unique("delegation_id_metadata_version_unique").on(
      table.id,
      table.metadata_version
    ),
  ]
);

export const eserviceInReadmodel_catalog = readmodel_catalog.table(
  "eservice",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    producer_id: uuid().notNull(),
    name: varchar().notNull(),
    description: varchar().notNull(),
    technology: varchar().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    mode: varchar().notNull(),
    is_signal_hub_enabled: boolean(),
    is_consumer_delegable: boolean(),
    is_client_access_delegable: boolean(),
    template_id: uuid(),
  },
  (table) => [
    unique("eservice_id_metadata_version_unique").on(
      table.id,
      table.metadata_version
    ),
  ]
);

export const eservice_descriptorInReadmodel_catalog = readmodel_catalog.table(
  "eservice_descriptor",
  {
    id: uuid().primaryKey().notNull(),
    eservice_id: uuid().notNull(),
    metadata_version: integer().notNull(),
    version: varchar().notNull(),
    description: varchar(),
    state: varchar().notNull(),
    audience: varchar().array().notNull(),
    voucher_lifespan: integer().notNull(),
    daily_calls_per_consumer: integer().notNull(),
    daily_calls_total: integer().notNull(),
    agreement_approval_policy: varchar(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    server_urls: varchar().array().notNull(),
    published_at: timestamp({ withTimezone: true, mode: "string" }),
    suspended_at: timestamp({ withTimezone: true, mode: "string" }),
    deprecated_at: timestamp({ withTimezone: true, mode: "string" }),
    archived_at: timestamp({ withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.eservice_id],
      foreignColumns: [eserviceInReadmodel_catalog.id],
      name: "eservice_descriptor_eservice_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.eservice_id, table.metadata_version],
      foreignColumns: [
        eserviceInReadmodel_catalog.id,
        eserviceInReadmodel_catalog.metadata_version,
      ],
      name: "eservice_descriptor_eservice_id_metadata_version_fkey",
    }),
  ]
);

export const eservice_descriptor_rejection_reasonInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_descriptor_rejection_reason",
    {
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      descriptor_id: uuid().notNull(),
      rejection_reason: varchar().notNull(),
      rejected_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_descriptor_rejection_reason_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptor_id],
        foreignColumns: [eservice_descriptorInReadmodel_catalog.id],
        name: "eservice_descriptor_rejection_reason_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_descriptor_rejection_eservice_id_metadata_version_fkey",
      }),
    ]
  );

export const eservice_descriptor_interfaceInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_descriptor_interface",
    {
      id: uuid().primaryKey().notNull(),
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      descriptor_id: uuid().notNull(),
      name: varchar().notNull(),
      content_type: varchar().notNull(),
      pretty_name: varchar().notNull(),
      path: varchar().notNull(),
      checksum: varchar().notNull(),
      upload_date: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_descriptor_interface_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptor_id],
        foreignColumns: [eservice_descriptorInReadmodel_catalog.id],
        name: "eservice_descriptor_interface_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_descriptor_interface_eservice_id_metadata_version_fkey",
      }),
      unique("eservice_descriptor_interface_descriptor_id_key").on(
        table.descriptor_id
      ),
    ]
  );

export const eservice_descriptor_documentInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_descriptor_document",
    {
      id: uuid().primaryKey().notNull(),
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      descriptor_id: uuid().notNull(),
      name: varchar().notNull(),
      content_type: varchar().notNull(),
      pretty_name: varchar().notNull(),
      path: varchar().notNull(),
      checksum: varchar().notNull(),
      upload_date: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_descriptor_document_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptor_id],
        foreignColumns: [eservice_descriptorInReadmodel_catalog.id],
        name: "eservice_descriptor_document_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_descriptor_document_eservice_id_metadata_version_fkey",
      }),
    ]
  );

export const delegation_contract_documentInReadmodel_delegation =
  readmodel_delegation.table(
    "delegation_contract_document",
    {
      id: uuid().primaryKey().notNull(),
      delegation_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      name: varchar().notNull(),
      content_type: varchar().notNull(),
      pretty_name: varchar().notNull(),
      path: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
      kind: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.delegation_id],
        foreignColumns: [delegationInReadmodel_delegation.id],
        name: "delegation_contract_document_delegation_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.delegation_id, table.metadata_version],
        foreignColumns: [
          delegationInReadmodel_delegation.id,
          delegationInReadmodel_delegation.metadata_version,
        ],
        name: "delegation_contract_document_delegation_id_metadata_versio_fkey",
      }),
      unique("delegation_contract_document_delegation_id_kind_unique").on(
        table.delegation_id,
        table.kind
      ),
    ]
  );

export const eservice_template_risk_analysisInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template_risk_analysis",
    {
      id: uuid().primaryKey().notNull(),
      eservice_template_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      name: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
      risk_analysis_form_id: uuid().notNull(),
      risk_analysis_form_version: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_template_id],
        foreignColumns: [eservice_templateInReadmodel_eservice_template.id],
        name: "eservice_template_risk_analysis_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_template_id, table.metadata_version],
        foreignColumns: [
          eservice_templateInReadmodel_eservice_template.id,
          eservice_templateInReadmodel_eservice_template.metadata_version,
        ],
        name: "eservice_template_risk_analys_eservice_template_id_metadat_fkey",
      }),
      unique("eservice_template_risk_analysis_risk_analysis_form_id_key").on(
        table.risk_analysis_form_id
      ),
    ]
  );

export const clientInReadmodel_client = readmodel_client.table(
  "client",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    consumer_id: uuid().notNull(),
    admin_id: uuid(),
    name: varchar().notNull(),
    description: varchar(),
    kind: varchar().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    unique("client_id_metadata_version_unique").on(
      table.id,
      table.metadata_version
    ),
  ]
);

export const purposeInReadmodel_purpose = readmodel_purpose.table(
  "purpose",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    eservice_id: uuid().notNull(),
    consumer_id: uuid().notNull(),
    delegation_id: uuid(),
    suspended_by_consumer: boolean(),
    suspended_by_producer: boolean(),
    title: varchar().notNull(),
    description: varchar().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    updated_at: timestamp({ withTimezone: true, mode: "string" }),
    is_free_of_charge: boolean().notNull(),
    free_of_charge_reason: varchar(),
  },
  (table) => [
    unique("purpose_id_metadata_version_unique").on(
      table.id,
      table.metadata_version
    ),
  ]
);

export const eservice_template_risk_analysis_answerInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template_risk_analysis_answer",
    {
      id: uuid().primaryKey().notNull(),
      eservice_template_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      risk_analysis_form_id: uuid().notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_template_id],
        foreignColumns: [eservice_templateInReadmodel_eservice_template.id],
        name: "eservice_template_risk_analysis_answe_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.risk_analysis_form_id],
        foreignColumns: [
          eservice_template_risk_analysisInReadmodel_eservice_template.risk_analysis_form_id,
        ],
        name: "eservice_template_risk_analysis_answ_risk_analysis_form_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_template_id, table.metadata_version],
        foreignColumns: [
          eservice_templateInReadmodel_eservice_template.id,
          eservice_templateInReadmodel_eservice_template.metadata_version,
        ],
        name: "eservice_template_risk_analy_eservice_template_id_metadat_fkey1",
      }),
    ]
  );

export const producer_keychainInReadmodel_producer_keychain =
  readmodel_producer_keychain.table(
    "producer_keychain",
    {
      id: uuid().primaryKey().notNull(),
      metadata_version: integer().notNull(),
      producer_id: uuid().notNull(),
      name: varchar().notNull(),
      description: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      unique("producer_keychain_id_metadata_version_unique").on(
        table.id,
        table.metadata_version
      ),
    ]
  );

export const purpose_versionInReadmodel_purpose = readmodel_purpose.table(
  "purpose_version",
  {
    id: uuid().primaryKey().notNull(),
    purpose_id: uuid().notNull(),
    metadata_version: integer().notNull(),
    state: varchar().notNull(),
    daily_calls: integer().notNull(),
    rejection_reason: varchar(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    updated_at: timestamp({ withTimezone: true, mode: "string" }),
    first_activation_at: timestamp({ withTimezone: true, mode: "string" }),
    suspended_at: timestamp({ withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.purpose_id],
      foreignColumns: [purposeInReadmodel_purpose.id],
      name: "purpose_version_purpose_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.purpose_id, table.metadata_version],
      foreignColumns: [
        purposeInReadmodel_purpose.id,
        purposeInReadmodel_purpose.metadata_version,
      ],
      name: "purpose_version_purpose_id_metadata_version_fkey",
    }),
  ]
);

export const tenantInReadmodel_tenant = readmodel_tenant.table(
  "tenant",
  {
    id: uuid().primaryKey().notNull(),
    metadata_version: integer().notNull(),
    kind: varchar(),
    selfcare_id: varchar(),
    external_id_origin: varchar().notNull(),
    external_id_value: varchar().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    updated_at: timestamp({ withTimezone: true, mode: "string" }),
    name: varchar().notNull(),
    onboarded_at: timestamp({ withTimezone: true, mode: "string" }),
    sub_unit_type: varchar(),
  },
  (table) => [
    unique("tenant_id_metadata_version_unique").on(
      table.id,
      table.metadata_version
    ),
  ]
);

export const tenant_verified_attribute_verifierInReadmodel_tenant =
  readmodel_tenant.table(
    "tenant_verified_attribute_verifier",
    {
      tenant_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      tenant_verifier_id: uuid().notNull(),
      tenant_verified_attribute_id: uuid().notNull(),
      verification_date: timestamp({
        withTimezone: true,
        mode: "string",
      }).notNull(),
      expiration_date: timestamp({ withTimezone: true, mode: "string" }),
      extension_date: timestamp({ withTimezone: true, mode: "string" }),
      delegation_id: uuid(),
    },
    (table) => [
      foreignKey({
        columns: [table.tenant_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_verified_attribute_verifier_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenant_id, table.tenant_verified_attribute_id],
        foreignColumns: [
          tenant_verified_attributeInReadmodel_tenant.attribute_id,
          tenant_verified_attributeInReadmodel_tenant.tenant_id,
        ],
        name: "tenant_verified_attribute_ver_tenant_id_tenant_verified_at_fkey",
      }),
      foreignKey({
        columns: [table.tenant_verifier_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_verified_attribute_verifier_tenant_verifier_id_fkey",
      }),
      foreignKey({
        columns: [table.tenant_id, table.metadata_version],
        foreignColumns: [
          tenantInReadmodel_tenant.id,
          tenantInReadmodel_tenant.metadata_version,
        ],
        name: "tenant_verified_attribute_verif_tenant_id_metadata_version_fkey",
      }),
    ]
  );

export const tenant_verified_attribute_revokerInReadmodel_tenant =
  readmodel_tenant.table(
    "tenant_verified_attribute_revoker",
    {
      tenant_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      tenant_revoker_id: uuid().notNull(),
      tenant_verified_attribute_id: uuid().notNull(),
      verification_date: timestamp({
        withTimezone: true,
        mode: "string",
      }).notNull(),
      expiration_date: timestamp({ withTimezone: true, mode: "string" }),
      extension_date: timestamp({ withTimezone: true, mode: "string" }),
      revocation_date: timestamp({
        withTimezone: true,
        mode: "string",
      }).notNull(),
      delegation_id: uuid(),
    },
    (table) => [
      foreignKey({
        columns: [table.tenant_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_verified_attribute_revoker_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenant_id, table.tenant_verified_attribute_id],
        foreignColumns: [
          tenant_verified_attributeInReadmodel_tenant.attribute_id,
          tenant_verified_attributeInReadmodel_tenant.tenant_id,
        ],
        name: "tenant_verified_attribute_rev_tenant_id_tenant_verified_at_fkey",
      }),
      foreignKey({
        columns: [table.tenant_revoker_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_verified_attribute_revoker_tenant_revoker_id_fkey",
      }),
      foreignKey({
        columns: [table.tenant_id, table.metadata_version],
        foreignColumns: [
          tenantInReadmodel_tenant.id,
          tenantInReadmodel_tenant.metadata_version,
        ],
        name: "tenant_verified_attribute_revok_tenant_id_metadata_version_fkey",
      }),
    ]
  );

export const client_userInReadmodel_client = readmodel_client.table(
  "client_user",
  {
    metadata_version: integer().notNull(),
    client_id: uuid().notNull(),
    user_id: uuid().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.client_id],
      foreignColumns: [clientInReadmodel_client.id],
      name: "client_user_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metadata_version, table.client_id],
      foreignColumns: [
        clientInReadmodel_client.id,
        clientInReadmodel_client.metadata_version,
      ],
      name: "client_user_client_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.client_id, table.user_id],
      name: "client_user_pkey",
    }),
  ]
);

export const client_purposeInReadmodel_client = readmodel_client.table(
  "client_purpose",
  {
    metadata_version: integer().notNull(),
    client_id: uuid().notNull(),
    purpose_id: uuid().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.client_id],
      foreignColumns: [clientInReadmodel_client.id],
      name: "client_purpose_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metadata_version, table.client_id],
      foreignColumns: [
        clientInReadmodel_client.id,
        clientInReadmodel_client.metadata_version,
      ],
      name: "client_purpose_client_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.client_id, table.purpose_id],
      name: "client_purpose_pkey",
    }),
  ]
);

export const producer_keychain_userInReadmodel_producer_keychain =
  readmodel_producer_keychain.table(
    "producer_keychain_user",
    {
      metadata_version: integer().notNull(),
      producer_keychain_id: uuid().notNull(),
      user_id: uuid().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.producer_keychain_id],
        foreignColumns: [producer_keychainInReadmodel_producer_keychain.id],
        name: "producer_keychain_user_producer_keychain_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadata_version, table.producer_keychain_id],
        foreignColumns: [
          producer_keychainInReadmodel_producer_keychain.id,
          producer_keychainInReadmodel_producer_keychain.metadata_version,
        ],
        name: "producer_keychain_user_producer_keychain_id_metadata_versi_fkey",
      }),
      primaryKey({
        columns: [table.producer_keychain_id, table.user_id],
        name: "producer_keychain_user_pkey",
      }),
    ]
  );

export const producer_keychain_eserviceInReadmodel_producer_keychain =
  readmodel_producer_keychain.table(
    "producer_keychain_eservice",
    {
      metadata_version: integer().notNull(),
      producer_keychain_id: uuid().notNull(),
      eservice_id: uuid().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.producer_keychain_id],
        foreignColumns: [producer_keychainInReadmodel_producer_keychain.id],
        name: "producer_keychain_eservice_producer_keychain_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadata_version, table.producer_keychain_id],
        foreignColumns: [
          producer_keychainInReadmodel_producer_keychain.id,
          producer_keychainInReadmodel_producer_keychain.metadata_version,
        ],
        name: "producer_keychain_eservice_producer_keychain_id_metadata_v_fkey",
      }),
      primaryKey({
        columns: [table.producer_keychain_id, table.eservice_id],
        name: "producer_keychain_eservice_pkey",
      }),
    ]
  );

export const agreement_attributeInReadmodel_agreement =
  readmodel_agreement.table(
    "agreement_attribute",
    {
      agreement_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      attribute_id: uuid().notNull(),
      kind: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.agreement_id],
        foreignColumns: [agreementInReadmodel_agreement.id],
        name: "agreement_attribute_agreement_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.agreement_id, table.metadata_version],
        foreignColumns: [
          agreementInReadmodel_agreement.id,
          agreementInReadmodel_agreement.metadata_version,
        ],
        name: "agreement_attribute_agreement_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.agreement_id, table.attribute_id],
        name: "agreement_attribute_pkey",
      }),
    ]
  );

export const tenant_verified_attributeInReadmodel_tenant =
  readmodel_tenant.table(
    "tenant_verified_attribute",
    {
      attribute_id: uuid().notNull(),
      tenant_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      assignment_timestamp: timestamp({
        withTimezone: true,
        mode: "string",
      }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.tenant_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_verified_attribute_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenant_id, table.metadata_version],
        foreignColumns: [
          tenantInReadmodel_tenant.id,
          tenantInReadmodel_tenant.metadata_version,
        ],
        name: "tenant_verified_attribute_tenant_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.attribute_id, table.tenant_id],
        name: "tenant_verified_attribute_pkey",
      }),
    ]
  );

export const delegation_stampInReadmodel_delegation =
  readmodel_delegation.table(
    "delegation_stamp",
    {
      delegation_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      who: uuid().notNull(),
      when: timestamp({ withTimezone: true, mode: "string" }).notNull(),
      kind: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.delegation_id],
        foreignColumns: [delegationInReadmodel_delegation.id],
        name: "delegation_stamp_delegation_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.delegation_id, table.metadata_version],
        foreignColumns: [
          delegationInReadmodel_delegation.id,
          delegationInReadmodel_delegation.metadata_version,
        ],
        name: "delegation_stamp_delegation_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.delegation_id, table.kind],
        name: "delegation_stamp_pkey",
      }),
    ]
  );

export const purpose_risk_analysis_formInReadmodel_purpose =
  readmodel_purpose.table(
    "purpose_risk_analysis_form",
    {
      id: uuid().notNull(),
      purpose_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      version: varchar().notNull(),
      risk_analysis_id: uuid(),
    },
    (table) => [
      foreignKey({
        columns: [table.purpose_id],
        foreignColumns: [purposeInReadmodel_purpose.id],
        name: "purpose_risk_analysis_form_purpose_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purpose_id, table.metadata_version],
        foreignColumns: [
          purposeInReadmodel_purpose.id,
          purposeInReadmodel_purpose.metadata_version,
        ],
        name: "purpose_risk_analysis_form_purpose_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.id, table.purpose_id],
        name: "purpose_risk_analysis_form_pkey",
      }),
    ]
  );

export const tenant_certified_attributeInReadmodel_tenant =
  readmodel_tenant.table(
    "tenant_certified_attribute",
    {
      attribute_id: uuid().notNull(),
      tenant_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      assignment_timestamp: timestamp({
        withTimezone: true,
        mode: "string",
      }).notNull(),
      revocation_timestamp: timestamp({ withTimezone: true, mode: "string" }),
    },
    (table) => [
      foreignKey({
        columns: [table.tenant_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_certified_attribute_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenant_id, table.metadata_version],
        foreignColumns: [
          tenantInReadmodel_tenant.id,
          tenantInReadmodel_tenant.metadata_version,
        ],
        name: "tenant_certified_attribute_tenant_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.attribute_id, table.tenant_id],
        name: "tenant_certified_attribute_pkey",
      }),
    ]
  );

export const tenant_featureInReadmodel_tenant = readmodel_tenant.table(
  "tenant_feature",
  {
    tenant_id: uuid().notNull(),
    metadata_version: integer().notNull(),
    kind: varchar().notNull(),
    certifier_id: varchar(),
    availability_timestamp: timestamp({ withTimezone: true, mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.tenant_id],
      foreignColumns: [tenantInReadmodel_tenant.id],
      name: "tenant_feature_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenant_id, table.metadata_version],
      foreignColumns: [
        tenantInReadmodel_tenant.id,
        tenantInReadmodel_tenant.metadata_version,
      ],
      name: "tenant_feature_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.tenant_id, table.kind],
      name: "tenant_feature_pkey",
    }),
  ]
);

export const agreement_stampInReadmodel_agreement = readmodel_agreement.table(
  "agreement_stamp",
  {
    agreement_id: uuid().notNull(),
    metadata_version: integer().notNull(),
    who: uuid().notNull(),
    delegation_id: uuid(),
    when: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    kind: varchar().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agreement_id],
      foreignColumns: [agreementInReadmodel_agreement.id],
      name: "agreement_stamp_agreement_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.agreement_id, table.metadata_version],
      foreignColumns: [
        agreementInReadmodel_agreement.id,
        agreementInReadmodel_agreement.metadata_version,
      ],
      name: "agreement_stamp_agreement_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.agreement_id, table.kind],
      name: "agreement_stamp_pkey",
    }),
  ]
);

export const tenant_declared_attributeInReadmodel_tenant =
  readmodel_tenant.table(
    "tenant_declared_attribute",
    {
      attribute_id: uuid().notNull(),
      tenant_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      assignment_timestamp: timestamp({
        withTimezone: true,
        mode: "string",
      }).notNull(),
      revocation_timestamp: timestamp({ withTimezone: true, mode: "string" }),
      delegation_id: uuid(),
    },
    (table) => [
      foreignKey({
        columns: [table.tenant_id],
        foreignColumns: [tenantInReadmodel_tenant.id],
        name: "tenant_declared_attribute_tenant_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.tenant_id, table.metadata_version],
        foreignColumns: [
          tenantInReadmodel_tenant.id,
          tenantInReadmodel_tenant.metadata_version,
        ],
        name: "tenant_declared_attribute_tenant_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.attribute_id, table.tenant_id],
        name: "tenant_declared_attribute_pkey",
      }),
    ]
  );

export const eservice_descriptor_attributeInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_descriptor_attribute",
    {
      attribute_id: uuid().notNull(),
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      descriptor_id: uuid().notNull(),
      explicit_attribute_verification: boolean().notNull(),
      kind: varchar().notNull(),
      group_id: integer().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_descriptor_attribute_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptor_id],
        foreignColumns: [eservice_descriptorInReadmodel_catalog.id],
        name: "eservice_descriptor_attribute_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_descriptor_attribute_eservice_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.attribute_id, table.descriptor_id, table.group_id],
        name: "eservice_descriptor_attribute_pkey",
      }),
    ]
  );

export const eservice_risk_analysisInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_risk_analysis",
    {
      id: uuid().notNull(),
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      name: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
      risk_analysis_form_id: uuid().notNull(),
      risk_analysis_form_version: varchar().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_risk_analysis_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_risk_analysis_eservice_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.id, table.eservice_id],
        name: "eservice_risk_analysis_pkey",
      }),
      unique("eservice_risk_analysis_risk_analysis_form_id_eservice_id_key").on(
        table.eservice_id,
        table.risk_analysis_form_id
      ),
    ]
  );

export const eservice_template_version_attributeInReadmodel_eservice_template =
  readmodel_eservice_template.table(
    "eservice_template_version_attribute",
    {
      attribute_id: uuid().notNull(),
      eservice_template_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      version_id: uuid().notNull(),
      explicit_attribute_verification: boolean().notNull(),
      kind: varchar().notNull(),
      group_id: integer().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_template_id],
        foreignColumns: [eservice_templateInReadmodel_eservice_template.id],
        name: "eservice_template_version_attribute_eservice_template_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.version_id],
        foreignColumns: [
          eservice_template_versionInReadmodel_eservice_template.id,
        ],
        name: "eservice_template_version_attribute_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_template_id, table.metadata_version],
        foreignColumns: [
          eservice_templateInReadmodel_eservice_template.id,
          eservice_templateInReadmodel_eservice_template.metadata_version,
        ],
        name: "eservice_template_version_att_eservice_template_id_metadat_fkey",
      }),
      primaryKey({
        columns: [table.attribute_id, table.version_id, table.group_id],
        name: "eservice_template_version_attribute_pkey",
      }),
    ]
  );

export const eservice_risk_analysis_answerInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_risk_analysis_answer",
    {
      id: uuid().notNull(),
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      risk_analysis_form_id: uuid().notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array().notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_risk_analysis_answer_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_risk_analysis_answer_eservice_id_metadata_version_fkey",
      }),
      foreignKey({
        columns: [table.eservice_id, table.risk_analysis_form_id],
        foreignColumns: [
          eservice_risk_analysisInReadmodel_catalog.eservice_id,
          eservice_risk_analysisInReadmodel_catalog.risk_analysis_form_id,
        ],
        name: "eservice_risk_analysis_answer_risk_analysis_form_id_eservi_fkey",
      }).onDelete("cascade"),
      primaryKey({
        columns: [table.id, table.eservice_id],
        name: "eservice_risk_analysis_answer_pkey",
      }),
    ]
  );

export const purpose_risk_analysis_answerInReadmodel_purpose =
  readmodel_purpose.table(
    "purpose_risk_analysis_answer",
    {
      id: uuid().notNull(),
      purpose_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      risk_analysis_form_id: uuid().notNull(),
      kind: varchar().notNull(),
      key: varchar().notNull(),
      value: varchar().array(),
    },
    (table) => [
      foreignKey({
        columns: [table.purpose_id],
        foreignColumns: [purposeInReadmodel_purpose.id],
        name: "purpose_risk_analysis_answer_purpose_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purpose_id, table.risk_analysis_form_id],
        foreignColumns: [
          purpose_risk_analysis_formInReadmodel_purpose.id,
          purpose_risk_analysis_formInReadmodel_purpose.purpose_id,
        ],
        name: "purpose_risk_analysis_answer_risk_analysis_form_id_purpose_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purpose_id, table.metadata_version],
        foreignColumns: [
          purposeInReadmodel_purpose.id,
          purposeInReadmodel_purpose.metadata_version,
        ],
        name: "purpose_risk_analysis_answer_purpose_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.id, table.purpose_id],
        name: "purpose_risk_analysis_answer_pkey",
      }),
    ]
  );

export const purpose_version_documentInReadmodel_purpose =
  readmodel_purpose.table(
    "purpose_version_document",
    {
      purpose_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      purpose_version_id: uuid().notNull(),
      id: uuid().notNull(),
      content_type: varchar().notNull(),
      path: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.purpose_id],
        foreignColumns: [purposeInReadmodel_purpose.id],
        name: "purpose_version_document_purpose_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purpose_version_id],
        foreignColumns: [purpose_versionInReadmodel_purpose.id],
        name: "purpose_version_document_purpose_version_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.purpose_id, table.metadata_version],
        foreignColumns: [
          purposeInReadmodel_purpose.id,
          purposeInReadmodel_purpose.metadata_version,
        ],
        name: "purpose_version_document_purpose_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.purpose_version_id, table.id],
        name: "purpose_version_document_pkey",
      }),
      unique("purpose_version_document_purpose_version_id_key").on(
        table.purpose_version_id
      ),
    ]
  );

export const tenant_mailInReadmodel_tenant = readmodel_tenant.table(
  "tenant_mail",
  {
    id: varchar().notNull(),
    tenant_id: uuid().notNull(),
    metadata_version: integer().notNull(),
    kind: varchar().notNull(),
    address: varchar().notNull(),
    description: varchar(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenant_id],
      foreignColumns: [tenantInReadmodel_tenant.id],
      name: "tenant_mail_tenant_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenant_id, table.metadata_version],
      foreignColumns: [
        tenantInReadmodel_tenant.id,
        tenantInReadmodel_tenant.metadata_version,
      ],
      name: "tenant_mail_tenant_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.id, table.tenant_id, table.created_at],
      name: "tenant_mail_pkey",
    }),
  ]
);

export const agreement_contractInReadmodel_agreement =
  readmodel_agreement.table(
    "agreement_contract",
    {
      id: uuid().notNull(),
      agreement_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      name: varchar().notNull(),
      pretty_name: varchar().notNull(),
      content_type: varchar().notNull(),
      path: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.agreement_id],
        foreignColumns: [agreementInReadmodel_agreement.id],
        name: "agreement_contract_agreement_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.agreement_id, table.metadata_version],
        foreignColumns: [
          agreementInReadmodel_agreement.id,
          agreementInReadmodel_agreement.metadata_version,
        ],
        name: "agreement_contract_agreement_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.id, table.agreement_id],
        name: "agreement_contract_pkey",
      }),
      unique("agreement_contract_agreement_id_key").on(table.agreement_id),
    ]
  );

export const eservice_descriptor_template_version_refInReadmodel_catalog =
  readmodel_catalog.table(
    "eservice_descriptor_template_version_ref",
    {
      eservice_template_version_id: uuid().notNull(),
      eservice_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      descriptor_id: uuid().notNull(),
      contact_name: varchar(),
      contact_email: varchar(),
      contact_url: varchar(),
      terms_and_conditions_url: varchar(),
    },
    (table) => [
      foreignKey({
        columns: [table.eservice_id],
        foreignColumns: [eserviceInReadmodel_catalog.id],
        name: "eservice_descriptor_template_version_ref_eservice_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.descriptor_id],
        foreignColumns: [eservice_descriptorInReadmodel_catalog.id],
        name: "eservice_descriptor_template_version_ref_descriptor_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.eservice_id, table.metadata_version],
        foreignColumns: [
          eserviceInReadmodel_catalog.id,
          eserviceInReadmodel_catalog.metadata_version,
        ],
        name: "eservice_descriptor_template__eservice_id_metadata_version_fkey",
      }),
      primaryKey({
        columns: [table.eservice_template_version_id, table.descriptor_id],
        name: "eservice_descriptor_template_version_ref_pkey",
      }),
    ]
  );

export const client_jwk_keyInReadmodel_client_jwk_key =
  readmodel_client_jwk_key.table(
    "client_jwk_key",
    {
      client_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      alg: varchar().notNull(),
      e: varchar().notNull(),
      kid: varchar().notNull(),
      kty: varchar().notNull(),
      n: varchar().notNull(),
      use: varchar().notNull(),
    },
    (table) => [
      primaryKey({
        columns: [table.client_id, table.kid],
        name: "client_jwk_key_pkey",
      }),
    ]
  );

export const producer_jwk_keyInReadmodel_producer_jwk_key =
  readmodel_producer_jwk_key.table(
    "producer_jwk_key",
    {
      producer_keychain_id: uuid().notNull(),
      metadata_version: integer().notNull(),
      alg: varchar().notNull(),
      e: varchar().notNull(),
      kid: varchar().notNull(),
      kty: varchar().notNull(),
      n: varchar().notNull(),
      use: varchar().notNull(),
    },
    (table) => [
      primaryKey({
        columns: [table.producer_keychain_id, table.kid],
        name: "producer_jwk_key_pkey",
      }),
    ]
  );

export const client_keyInReadmodel_client = readmodel_client.table(
  "client_key",
  {
    metadata_version: integer().notNull(),
    client_id: uuid().notNull(),
    user_id: uuid(),
    kid: varchar().notNull(),
    name: varchar().notNull(),
    encoded_pem: varchar().notNull(),
    algorithm: varchar().notNull(),
    use: varchar().notNull(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.client_id],
      foreignColumns: [clientInReadmodel_client.id],
      name: "client_key_client_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.metadata_version, table.client_id],
      foreignColumns: [
        clientInReadmodel_client.id,
        clientInReadmodel_client.metadata_version,
      ],
      name: "client_key_client_id_metadata_version_fkey",
    }),
    primaryKey({
      columns: [table.client_id, table.kid],
      name: "client_key_pkey",
    }),
  ]
);

export const producer_keychain_keyInReadmodel_producer_keychain =
  readmodel_producer_keychain.table(
    "producer_keychain_key",
    {
      metadata_version: integer().notNull(),
      producer_keychain_id: uuid().notNull(),
      user_id: uuid().notNull(),
      kid: varchar().notNull(),
      name: varchar().notNull(),
      encoded_pem: varchar().notNull(),
      algorithm: varchar().notNull(),
      use: varchar().notNull(),
      created_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
      foreignKey({
        columns: [table.producer_keychain_id],
        foreignColumns: [producer_keychainInReadmodel_producer_keychain.id],
        name: "producer_keychain_key_producer_keychain_id_fkey",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.metadata_version, table.producer_keychain_id],
        foreignColumns: [
          producer_keychainInReadmodel_producer_keychain.id,
          producer_keychainInReadmodel_producer_keychain.metadata_version,
        ],
        name: "producer_keychain_key_producer_keychain_id_metadata_versio_fkey",
      }),
      primaryKey({
        columns: [table.producer_keychain_id, table.kid],
        name: "producer_keychain_key_pkey",
      }),
    ]
  );
