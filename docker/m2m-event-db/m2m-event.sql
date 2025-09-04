CREATE SCHEMA IF NOT EXISTS m2m_event;

CREATE TABLE IF NOT EXISTS m2m_event.eservice_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  eservice_id UUID NOT NULL,
  descriptor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.eservice_template_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  template_id UUID NOT NULL,
  version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.agreement_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  agreement_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.purpose_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  purpose_id UUID NOT NULL,
  version_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.tenant_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.attribute_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  attribute_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.consumer_delegation_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  delegation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_delegation_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  delegation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.client_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  client_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_keychain_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  keychain_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.key_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  kid UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_key_m2m_event (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  kid UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);
