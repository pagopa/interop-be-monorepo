import { integer, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { m2mEvent } from "../pgSchema.js";

export const eserviceInM2MEvent = m2mEvent.table("eservice", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  descriptorId: uuid("descriptor_id"),
  producerId: uuid("producer_id").notNull(),
  producerDelegateId: uuid("producer_delegate_id"),
  producerDelegationId: uuid("producer_delegation_id"),
  visibility: varchar().notNull(),
});

export const eserviceTemplateInM2MEvent = m2mEvent.table("eservice_template", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  eserviceTemplateId: uuid("eservice_template_id").notNull(),
  eserviceTemplateVersionId: uuid("eservice_template_version_id"),
  creatorId: uuid("creator_id").notNull(),
  visibility: varchar().notNull(),
});

export const agreementInM2MEvent = m2mEvent.table("agreement", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  agreementId: uuid("agreement_id").notNull(),
  consumerId: uuid("consumer_id").notNull(),
  producerId: uuid("producer_id").notNull(),
  consumerDelegateId: uuid("consumer_delegate_id"),
  consumerDelegationId: uuid("consumer_delegation_id"),
  producerDelegateId: uuid("producer_delegate_id"),
  producerDelegationId: uuid("producer_delegation_id"),
  visibility: varchar().notNull(),
});

export const purposeInM2MEvent = m2mEvent.table("purpose", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  purposeId: uuid("purpose_id").notNull(),
  purposeVersionId: uuid("purpose_version_id"),
  consumerId: uuid("consumer_id").notNull(),
  producerId: uuid("producer_id").notNull(),
  consumerDelegateId: uuid("consumer_delegate_id"),
  consumerDelegationId: uuid("consumer_delegation_id"),
  producerDelegateId: uuid("producer_delegate_id"),
  producerDelegationId: uuid("producer_delegation_id"),
  visibility: varchar().notNull(),
});

export const tenantInM2MEvent = m2mEvent.table("tenant", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  tenantId: uuid("tenant_id").notNull(),
});

export const attributeInM2MEvent = m2mEvent.table("attribute", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
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
    resourceVersion: integer("resource_version").notNull(),
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
    resourceVersion: integer("resource_version").notNull(),
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
  resourceVersion: integer("resource_version").notNull(),
  clientId: uuid("client_id").notNull(),
  consumerId: uuid("consumer_id").notNull(),
  visibility: varchar().notNull(),
});

export const producerKeychainInM2MEvent = m2mEvent.table("producer_keychain", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  producerKeychainId: uuid("producer_keychain_id").notNull(),
  producerId: uuid("producer_id").notNull(),
  visibility: varchar().notNull(),
});

export const keyInM2MEvent = m2mEvent.table("key", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  kid: varchar().notNull(),
  clientId: uuid("client_id").notNull(),
});

export const producerKeyInM2MEvent = m2mEvent.table("producer_key", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  kid: varchar().notNull(),
  producerKeychainId: uuid("producer_keychain_id").notNull(),
});

export const purposeTemplateInM2MEvent = m2mEvent.table("purpose_template", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  resourceVersion: integer("resource_version").notNull(),
  purposeTemplateId: uuid("purpose_template_id").notNull(),
  creatorId: uuid("creator_id").notNull(),
  visibility: varchar().notNull(),
});
