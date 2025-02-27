CREATE SCHEMA IF NOT EXISTS readmodel_producer_jwk_key;

CREATE TABLE IF NOT EXISTS readmodel_producer_jwk_key.producer_jwk_key(
  producer_keychain_id UUID NOT NULL,
  metadata_version INTEGER NOT NULL,
  alg VARCHAR NOT NULL,
  e VARCHAR NOT NULL,
  kid VARCHAR NOT NULL,
  kty VARCHAR NOT NULL,
  n VARCHAR NOT NULL,
  "use" VARCHAR NOT NULL,
  PRIMARY KEY (producer_keychain_id, kid)
);
