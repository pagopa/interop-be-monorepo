import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { m2mEvent } from "../pgSchema.js";

export const eserviceInM2MEvent = m2mEvent.table("eservice", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  descriptorId: uuid("descriptor_id"),
  visibility: varchar().notNull(),
  producerId: uuid("producer_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const eserviceTemplateInM2MEvent = m2mEvent.table("eservice_template", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  templateId: uuid("template_id").notNull(),
  versionId: uuid("version_id"),
  visibility: varchar().notNull(),
  creatorId: uuid("creator_id"),
});

export const agreementInM2MEvent = m2mEvent.table("agreement", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  agreementId: uuid("agreement_id").notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const purposeInM2MEvent = m2mEvent.table("purpose", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  purposeId: uuid("purpose_id").notNull(),
  versionId: uuid("version_id"),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const tenantInM2MEvent = m2mEvent.table("tenant", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  tenantId: uuid("tenant_id").notNull(),
});

export const attributeInM2MEvent = m2mEvent.table("attribute", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  attributeId: uuid("attribute_id").notNull(),
});

export const consumerDelegationInM2MEvent = m2mEvent.table(
  "consumer_delegation",
  {
    id: uuid().primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    delegationId: uuid("delegation_id").notNull(),
  }
);

export const producerDelegationInM2MEvent = m2mEvent.table(
  "producer_delegation",
  {
    id: uuid().primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    delegationId: uuid("delegation_id").notNull(),
  }
);

export const clientInM2MEvent = m2mEvent.table("client", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  clientId: uuid("client_id").notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
});

export const producerKeychainInM2MEvent = m2mEvent.table("producer_keychain", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  keychainId: uuid("keychain_id").notNull(),
  visibility: varchar().notNull(),
  producerId: uuid("producer_id"),
});

export const keyInM2MEvent = m2mEvent.table("key", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  kid: uuid().notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
});

export const producerKeyInM2MEvent = m2mEvent.table("producer_key", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  kid: uuid().notNull(),
  visibility: varchar().notNull(),
  producerId: uuid("producer_id"),
});
