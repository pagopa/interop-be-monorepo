CREATE TABLE IF NOT EXISTS readmodel.attribute(
  id UUID,
  version INTEGER NOT NULL,
  code VARCHAR NOT NULL,
  kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  origin VARCHAR,
  name VARCHAR NOT NULL,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);
