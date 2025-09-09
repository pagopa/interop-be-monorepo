CREATE SCHEMA IF NOT EXISTS m2m_event;

CREATE TABLE IF NOT EXISTS m2m_event.eservice (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  eservice_id UUID NOT NULL,
  descriptor_id UUID,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.eservice_template (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  template_id UUID NOT NULL,
  version_id UUID,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  creator_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.agreement (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  agreement_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.purpose (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  purpose_id UUID NOT NULL,
  version_id UUID,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.tenant (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  tenant_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.attribute (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  attribute_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.consumer_delegation (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  delegation_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_delegation (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  delegation_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.client (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  client_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_keychain (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  keychain_id UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.key (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  kid UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_key (
  event_id UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  kid UUID NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  PRIMARY KEY (event_id)
);
