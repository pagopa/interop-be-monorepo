CREATE TABLE IF NOT EXISTS readmodel.producer_keychain (
  id UUID,
  version INTEGER NOT NULL,
  producer_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  -- eservices
  description VARCHAR,
  -- users
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- keys
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.producer_keychain_user (
  producer_keychain_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (producer_keychain_id, user_id)
);

CREATE TABLE IF NOT EXISTS readmodel.producer_keychain_eservice (
  producer_keychain_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain (id) ON DELETE CASCADE,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id),
  PRIMARY KEY (producer_keychain_id, eservice_id)
);

CREATE TABLE IF NOT EXISTS readmodel.producer_keychain_key (
  producer_keychain_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kid VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  encoded_pem VARCHAR NOT NULL,
  algorithm VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (kid) -- TODO: probably kid can't be primary key
);
