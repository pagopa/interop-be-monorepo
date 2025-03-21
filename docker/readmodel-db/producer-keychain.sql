CREATE SCHEMA IF NOT EXISTS local_readmodel_producer_keychain;

CREATE TABLE IF NOT EXISTS local_readmodel_producer_keychain.producer_keychain (
  id UUID,
  metadata_version INTEGER NOT NULL,
  producer_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT producer_keychain_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS local_readmodel_producer_keychain.producer_keychain_user (
  metadata_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES local_readmodel_producer_keychain.producer_keychain (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (producer_keychain_id, user_id),
  FOREIGN KEY (producer_keychain_id, metadata_version) REFERENCES local_readmodel_producer_keychain.producer_keychain (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS local_readmodel_producer_keychain.producer_keychain_eservice (
  metadata_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES local_readmodel_producer_keychain.producer_keychain (id) ON DELETE CASCADE,
  eservice_id UUID NOT NULL,
  PRIMARY KEY (producer_keychain_id, eservice_id),
  FOREIGN KEY (producer_keychain_id, metadata_version) REFERENCES local_readmodel_producer_keychain.producer_keychain (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS local_readmodel_producer_keychain.producer_keychain_key (
  metadata_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES local_readmodel_producer_keychain.producer_keychain (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kid VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  encoded_pem VARCHAR NOT NULL,
  "algorithm" VARCHAR NOT NULL,
  "use" VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (producer_keychain_id, kid),
  FOREIGN KEY (producer_keychain_id, metadata_version) REFERENCES local_readmodel_producer_keychain.producer_keychain (id, metadata_version)
);
