CREATE SCHEMA IF NOT EXISTS domains;

CREATE TABLE IF NOT EXISTS domains.attribute (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  code VARCHAR,
  kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  origin VARCHAR,
  name VARCHAR NOT NULL,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);
