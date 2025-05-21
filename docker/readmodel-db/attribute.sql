CREATE SCHEMA IF NOT EXISTS readmodel_attribute;

CREATE TABLE IF NOT EXISTS readmodel_attribute.attribute (
  id UUID,
  metadata_version INTEGER NOT NULL,
  code VARCHAR,
  kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  origin VARCHAR,
  name VARCHAR NOT NULL UNIQUE,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS attribute_code_origin_unique
  ON readmodel_attribute.attribute (code, origin)
  WHERE code IS NOT NULL AND origin IS NOT NULL;
