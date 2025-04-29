CREATE SCHEMA IF NOT EXISTS readmodel_client;

CREATE TABLE IF NOT EXISTS readmodel_client.client (
  id UUID,
  metadata_version INTEGER NOT NULL,
  consumer_id UUID NOT NULL,
  admin_id UUID,
  name VARCHAR NOT NULL,
  description VARCHAR,
  kind VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT client_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_client.client_user (
  metadata_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel_client.client (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (client_id, user_id),
  FOREIGN KEY (client_id, metadata_version) REFERENCES readmodel_client.client (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_client.client_purpose (
  metadata_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel_client.client (id) ON DELETE CASCADE,
  purpose_id UUID NOT NULL,
  PRIMARY KEY (client_id, purpose_id),
  FOREIGN KEY (client_id, metadata_version) REFERENCES readmodel_client.client (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_client.client_key (
  metadata_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel_client.client (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kid VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  encoded_pem VARCHAR NOT NULL,
  "algorithm" VARCHAR NOT NULL,
  "use" VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (client_id, kid),
  FOREIGN KEY (client_id, metadata_version) REFERENCES readmodel_client.client (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
