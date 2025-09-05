import { pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const m2MEvent = pgSchema("m2m_event");

export const eserviceInM2MEvent = m2MEvent.table("eservice", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  descriptorId: uuid("descriptor_id"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const eserviceTemplateInM2MEvent = m2MEvent.table("eservice_template", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  templateId: uuid("template_id").notNull(),
  versionId: uuid("version_id"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const agreementInM2MEvent = m2MEvent.table("agreement", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  agreementId: uuid("agreement_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const purposeInM2MEvent = m2MEvent.table("purpose", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  purposeId: uuid("purpose_id").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const tenantInM2MEvent = m2MEvent.table("tenant", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  tenantId: uuid("tenant_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const attributeInM2MEvent = m2MEvent.table("attribute", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  attributeId: uuid("attribute_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const consumerDelegationInM2MEvent = m2MEvent.table(
  "consumer_delegation",
  {
    id: uuid().primaryKey().notNull(),
    type: varchar().notNull(),
    delegationId: uuid("delegation_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    visibility: varchar().notNull(),
    consumerId: uuid("consumer_id"),
    producerId: uuid("producer_id"),
    consumerDelegateId: uuid("consumer_delegate_id"),
    producerDelegateId: uuid("producer_delegate_id"),
  }
);

export const producerDelegationInM2MEvent = m2MEvent.table(
  "producer_delegation",
  {
    id: uuid().primaryKey().notNull(),
    type: varchar().notNull(),
    delegationId: uuid("delegation_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    visibility: varchar().notNull(),
    consumerId: uuid("consumer_id"),
    producerId: uuid("producer_id"),
    consumerDelegateId: uuid("consumer_delegate_id"),
    producerDelegateId: uuid("producer_delegate_id"),
  }
);

export const clientInM2MEvent = m2MEvent.table("client", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  clientId: uuid("client_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const producerKeychainInM2MEvent = m2MEvent.table("producer_keychain", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  keychainId: uuid("keychain_id").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const keyInM2MEvent = m2MEvent.table("key", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  kid: uuid().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const producerKeyInM2MEvent = m2MEvent.table("producer_key", {
  id: uuid().primaryKey().notNull(),
  type: varchar().notNull(),
  kid: uuid().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});
