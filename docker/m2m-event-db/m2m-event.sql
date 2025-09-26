CREATE SCHEMA IF NOT EXISTS m2m_event;

CREATE TABLE IF NOT EXISTS m2m_event.eservice_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  eservice_id UUID NOT NULL,
  descriptor_id UUID,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  producer_delegate_id UUID,
  producer_delegation_id UUID,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.eservice_template_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  eservice_template_id UUID NOT NULL,
  eservice_template_version_id UUID,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  creator_id UUID,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.agreement_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  agreement_id UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  consumer_delegation_id UUID,
  producer_delegate_id UUID,
  producer_delegation_id UUID,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.purpose_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  purpose_id UUID NOT NULL,
  purpose_version_id UUID,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  consumer_delegation_id UUID,
  producer_delegate_id UUID,
  producer_delegation_id UUID,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.tenant_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  tenant_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.attribute_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  attribute_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.consumer_delegation_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  delegation_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_delegation_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  delegation_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.client_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  client_id UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  consumer_id UUID,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_keychain_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  producer_keychain_id UUID NOT NULL,

  -- Visibility columns, used to filter events based on tenant
  visibility VARCHAR NOT NULL,
  producer_id UUID,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.key_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  kid UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_key_m2m_event (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  kid UUID NOT NULL,

  PRIMARY KEY (id)
);
