CREATE SCHEMA IF NOT EXISTS readmodel_attribute;

CREATE TABLE IF NOT EXISTS readmodel_attribute.attribute (
  id UUID,
  metadata_version INTEGER NOT NULL,
  code VARCHAR,
  kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  origin VARCHAR,
  name VARCHAR UNIQUE NOT NULL,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT attribute_code_name_unique UNIQUE (code, name),
  CONSTRAINT attribute_origin_code_unique UNIQUE (origin, code)
);
