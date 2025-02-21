CREATE SCHEMA IF NOT EXISTS readmodel_client_jwk_key;

CREATE TABLE IF NOT EXISTS readmodel_client_jwk_key.client_jwk_key(
  client_id UUID NOT NULL,
  metadata_version INTEGER NOT NULL,
  alg VARCHAR NOT NULL,
  e VARCHAR NOT NULL,
  kid VARCHAR NOT NULL,
  kty VARCHAR NOT NULL,
  n VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  PRIMARY KEY (client_id, kid)
);
