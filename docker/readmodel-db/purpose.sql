CREATE SCHEMA IF NOT EXISTS readmodel_purpose;

CREATE TABLE IF NOT EXISTS readmodel_purpose.purpose (
  id UUID,
  metadata_version INTEGER NOT NULL,
  eservice_id UUID NOT NULL,
  consumer_id UUID NOT NULL,
  delegation_id UUID,
  suspended_by_consumer BOOLEAN,
  suspended_by_producer BOOLEAN,
  title VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_free_of_charge BOOLEAN NOT NULL,
  free_of_charge_reason VARCHAR,
  purpose_template_id UUID,
  PRIMARY KEY (id),
  CONSTRAINT purpose_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_purpose.purpose_risk_analysis_form (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel_purpose.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version VARCHAR NOT NULL,
  risk_analysis_id UUID,
  PRIMARY KEY (id, purpose_id),
  FOREIGN KEY (purpose_id, metadata_version) REFERENCES readmodel_purpose.purpose (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose.purpose_risk_analysis_answer (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel_purpose.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL,
  kind VARCHAR NOT NULL,
  "key" VARCHAR NOT NULL,
  value VARCHAR ARRAY NOT NULL,
  PRIMARY KEY (id, purpose_id),
  FOREIGN KEY (risk_analysis_form_id, purpose_id) REFERENCES readmodel_purpose.purpose_risk_analysis_form (id, purpose_id) ON DELETE CASCADE,
  FOREIGN KEY (purpose_id, metadata_version) REFERENCES readmodel_purpose.purpose (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose.purpose_version (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel_purpose.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  state VARCHAR NOT NULL,
  daily_calls INTEGER NOT NULL,
  rejection_reason VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  first_activation_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  FOREIGN KEY (purpose_id, metadata_version) REFERENCES readmodel_purpose.purpose (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose.purpose_version_document (
  purpose_id UUID NOT NULL REFERENCES readmodel_purpose.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  purpose_version_id UUID UNIQUE NOT NULL REFERENCES readmodel_purpose.purpose_version (id) ON DELETE CASCADE,
  id UUID NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id, purpose_version_id),
  FOREIGN KEY (purpose_id, metadata_version) REFERENCES readmodel_purpose.purpose (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose.purpose_version_stamp (
  purpose_id UUID NOT NULL REFERENCES readmodel_purpose.purpose (id) ON DELETE CASCADE,
  purpose_version_id UUID NOT NULL REFERENCES readmodel_purpose.purpose_version (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  who UUID NOT NULL,
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY (purpose_version_id, kind),
  FOREIGN KEY (purpose_id, metadata_version) REFERENCES readmodel_purpose.purpose (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
