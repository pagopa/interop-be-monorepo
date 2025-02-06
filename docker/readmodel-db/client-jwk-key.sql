CREATE TABLE IF NOT EXISTS readmodel.client_jwk_key(
  client_id UUID NOT NULL,
  version INTEGER NOT NULL,
  alg VARCHAR NOT NULL,
  e VARCHAR NOT NULL,
  kid VARCHAR NOT NULL,
  kty VARCHAR NOT NULL,
  n VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  PRIMARY KEY (kid) -- same as above
);
