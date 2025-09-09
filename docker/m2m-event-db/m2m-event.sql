CREATE SCHEMA IF NOT EXISTS m2m_event;

CREATE TABLE IF NOT EXISTS m2m_event.eservice (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  eservice_id UUID NOT NULL,
  descriptor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.eservice_template (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  template_id UUID NOT NULL,
  version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  creator_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.agreement (
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

CREATE TABLE IF NOT EXISTS m2m_event.purpose (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  purpose_id UUID NOT NULL,
  version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  producer_id UUID,
  consumer_delegate_id UUID,
  producer_delegate_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.tenant (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.attribute (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  attribute_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.consumer_delegation (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  delegation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_delegation (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  delegation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.client (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  client_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_keychain (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  keychain_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.key (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  kid UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  consumer_id UUID,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS m2m_event.producer_key (
  id UUID NOT NULL,
  type VARCHAR NOT NULL,
  kid UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  visibility VARCHAR NOT NULL,
  producer_id UUID,
  PRIMARY KEY (id)
);
