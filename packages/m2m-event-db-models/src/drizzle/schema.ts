import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { m2mEvent } from "../pgSchema.js";

export const eserviceM2MEventInM2MEvent = m2mEvent.table("eservice_m2m_event", {
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
  producerDelegationId: uuid("producer_delegation_id"),
});

export const eserviceTemplateM2MEventInM2MEvent = m2mEvent.table(
  "eservice_template_m2m_event",
  {
    id: uuid().primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    eserviceTemplateId: uuid("eservice_template_id").notNull(),
    eserviceTemplateVersionId: uuid("eservice_template_version_id"),
    visibility: varchar().notNull(),
    creatorId: uuid("creator_id"),
  }
);

export const agreementM2MEventInM2MEvent = m2mEvent.table(
  "agreement_m2m_event",
  {
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
    consumerDelegationId: uuid("consumer_delegation_id"),
    producerDelegateId: uuid("producer_delegate_id"),
    producerDelegationId: uuid("producer_delegation_id"),
  }
);

export const purposeM2MEventInM2MEvent = m2mEvent.table("purpose_m2m_event", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  purposeId: uuid("purpose_id").notNull(),
  purposeVersionId: uuid("purpose_version_id"),
  visibility: varchar().notNull(),
  consumerId: uuid("consumer_id"),
  producerId: uuid("producer_id"),
  consumerDelegateId: uuid("consumer_delegate_id"),
  consumerDelegationId: uuid("consumer_delegation_id"),
  producerDelegateId: uuid("producer_delegate_id"),
  producerDelegationId: uuid("producer_delegation_id"),
});

export const tenantM2MEventInM2MEvent = m2mEvent.table("tenant_m2m_event", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  tenantId: uuid("tenant_id").notNull(),
});

export const attributeM2MEventInM2MEvent = m2mEvent.table(
  "attribute_m2m_event",
  {
    id: uuid().primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    attributeId: uuid("attribute_id").notNull(),
  }
);

export const consumerDelegationM2MEventInM2MEvent = m2mEvent.table(
  "consumer_delegation_m2m_event",
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

export const producerDelegationM2MEventInM2MEvent = m2mEvent.table(
  "producer_delegation_m2m_event",
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

export const clientM2MEventInM2MEvent = m2mEvent.table("client_m2m_event", {
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

export const producerKeychainM2MEventInM2MEvent = m2mEvent.table(
  "producer_keychain_m2m_event",
  {
    id: uuid().primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    producerKeychainId: uuid("producer_keychain_id").notNull(),
    visibility: varchar().notNull(),
    producerId: uuid("producer_id"),
  }
);

export const keyM2MEventInM2MEvent = m2mEvent.table("key_m2m_event", {
  id: uuid().primaryKey().notNull(),
  eventType: varchar("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  kid: uuid().notNull(),
});

export const producerKeyM2MEventInM2MEvent = m2mEvent.table(
  "producer_key_m2m_event",
  {
    id: uuid().primaryKey().notNull(),
    eventType: varchar("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    kid: uuid().notNull(),
  }
);
