import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { m2mEvent } from "../pgSchema.js";

export const eserviceInM2MEvent = m2mEvent.table("eservice", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eserviceId: uuid("eservice_id").notNull(),
  descriptorId: uuid("descriptor_id"),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  producerId: uuid("producer_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const eserviceTemplateInM2MEvent = m2mEvent.table("eservice_template", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  templateId: uuid("template_id").notNull(),
  versionId: uuid("version_id"),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  creatorId: uuid("creator_id"),
});

export const agreementInM2MEvent = m2mEvent.table("agreement", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  agreementId: uuid("agreement_id").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const purposeInM2MEvent = m2mEvent.table("purpose", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  purposeId: uuid("purpose_id").notNull(),
  versionId: uuid("version_id"),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  producerDelegateId: uuid("producer_delegate_id"),
});

export const tenantInM2MEvent = m2mEvent.table("tenant", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const attributeInM2MEvent = m2mEvent.table("attribute", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  attributeId: uuid("attribute_id").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const consumerDelegationInM2MEvent = m2mEvent.table(
  "consumer_delegation",
  {
    eventId: uuid("event_id").primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    delegationId: uuid("delegation_id").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  }
);

export const producerDelegationInM2MEvent = m2mEvent.table(
  "producer_delegation",
  {
    eventId: uuid("event_id").primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    delegationId: uuid("delegation_id").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  }
);

export const clientInM2MEvent = m2mEvent.table("client", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  clientId: uuid("client_id").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
});

export const producerKeychainInM2MEvent = m2mEvent.table("producer_keychain", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  keychainId: uuid("keychain_id").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  producerId: uuid("producer_id"),
});

export const keyInM2MEvent = m2mEvent.table("key", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  kid: uuid().notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
});

export const producerKeyInM2MEvent = m2mEvent.table("producer_key", {
  eventId: uuid("event_id").primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  kid: uuid().notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  visibility: varchar().notNull(),
  producerId: uuid("producer_id"),
});
