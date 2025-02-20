CREATE SCHEMA IF NOT EXISTS readmodel_client;

CREATE TABLE IF NOT EXISTS readmodel_client.client (
  id UUID,
  metadata_version INTEGER NOT NULL,
  consumer_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description VARCHAR,
  kind VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel_client.client_user (
  metadata_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel_client.client (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (client_id, user_id)
);

CREATE TABLE IF NOT EXISTS readmodel_client.client_purpose (
  metadata_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel_client.client (id) ON DELETE CASCADE,
  purpose_id UUID NOT NULL,
  PRIMARY KEY (client_id, purpose_id)
);

CREATE TABLE IF NOT EXISTS readmodel_client.client_key (
  metadata_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel_client.client (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kid VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  encoded_pem VARCHAR NOT NULL,
  algorithm VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (client_id, kid)
);