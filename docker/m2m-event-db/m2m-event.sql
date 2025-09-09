CREATE SCHEMA IF NOT EXISTS m2m_event;

CREATE TABLE IF NOT EXISTS m2m_event.eservice (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  eservice_id UUID NOT NULL,
  descriptor_id UUID,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.eservice_template (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  template_id UUID NOT NULL,
  version_id UUID,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  creator_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.agreement (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  agreement_id UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.purpose (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  purpose_id UUID NOT NULL,
  version_id UUID,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.tenant (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  tenant_id UUID NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.attribute (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  attribute_id UUID NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.consumer_delegation (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  delegation_id UUID NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_delegation (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  delegation_id UUID NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.client (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  client_id UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_keychain (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  keychain_id UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.key (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  kid UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_key (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  kid UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  PRIMARY KEY (id)
);
