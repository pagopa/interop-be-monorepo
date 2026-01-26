CREATE SCHEMA IF NOT EXISTS m2m_event;

CREATE TABLE IF NOT EXISTS m2m_event.eservice (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  eservice_id UUID NOT NULL,
  descriptor_id UUID,

  -- Columns to filter events based on tenant or delegation
  producer_id UUID NOT NULL,
  producer_delegate_id UUID,
  producer_delegation_id UUID,

  visibility VARCHAR NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.eservice_template (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  eservice_template_id UUID NOT NULL,
  eservice_template_version_id UUID,

  -- Columns to filter events based on tenant
  creator_id UUID NOT NULL,

  visibility VARCHAR NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.agreement (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  agreement_id UUID NOT NULL,

  -- Columns to filter events based on tenant or delegation
  consumer_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  consumer_delegate_id UUID,
  consumer_delegation_id UUID,
  producer_delegate_id UUID,
  producer_delegation_id UUID,

  visibility VARCHAR NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.purpose (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  purpose_id UUID NOT NULL,
  purpose_version_id UUID,

  -- Columns to filter events based on tenant or delegation
  consumer_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  consumer_delegate_id UUID,
  consumer_delegation_id UUID,
  producer_delegate_id UUID,
  producer_delegation_id UUID,

  visibility VARCHAR NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.tenant (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  tenant_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.attribute (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  attribute_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.consumer_delegation (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  delegation_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_delegation (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  delegation_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.client (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  client_id UUID NOT NULL,

  -- Columns to filter events based on tenant
  consumer_id UUID NOT NULL,

  visibility VARCHAR NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_keychain (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  producer_keychain_id UUID NOT NULL,

  -- Columns to filter events based on tenant
  producer_id UUID NOT NULL,

  visibility VARCHAR NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.key (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  kid VARCHAR NOT NULL,
  client_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_key (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  kid VARCHAR NOT NULL,
  producer_keychain_id UUID NOT NULL,

  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.purpose_template (
  id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Reference to the resource involved in the event
  resource_version INT NOT NULL,
  purpose_template_id UUID NOT NULL,

  -- Columns to filter events based on tenant
  creator_id UUID NOT NULL,

  visibility VARCHAR NOT NULL,

 eservice_id UUID, 
  descriptor_id UUID,
  
  PRIMARY KEY (id)
);

