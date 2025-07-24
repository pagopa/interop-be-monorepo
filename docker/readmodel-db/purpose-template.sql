CREATE SCHEMA IF NOT EXISTS readmodel_purpose_template;

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template (
  id UUID,
  metadata_version INTEGER NOT NULL,
  "name" VARCHAR NOT NULL,
  "target" VARCHAR NOT NULL,
  creatorId UUID NOT NULL,
  "state" VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  "description" VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_free_of_charge BOOLEAN NOT NULL,
  free_of_charge_reason VARCHAR,
  daily_calls INTEGER,
  PRIMARY KEY (id),
  CONSTRAINT purpose_template_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_eservice_descriptor_version (
  metadata_version INTEGER NOT NULL,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  eservice_id UUID NOT NULL, --> readmodel_catalog.eservice.id  
  eservice_descriptor_id UUID NOT NULL, --> readmodel_catalog.eservice_descriptor.id
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_risk_analysis_form (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  "version" VARCHAR NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT purpose_template_risk_analysis_form_purpose_template_id_unique UNIQUE (purpose_template_id),
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_risk_analysis_answer (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL,
  kind VARCHAR NOT NULL,
  "key" VARCHAR NOT NULL,
  "value" VARCHAR ARRAY NOT NULL,
  editable BOOLEAN NOT NULL,
  instruction VARCHAR,
  suggestedValues VARCHAR ARRAY,
  PRIMARY KEY (id, purpose_template_id),
  FOREIGN KEY (risk_analysis_form_id, purpose_template_id) REFERENCES readmodel_purpose_template.purpose_template_risk_analysis_form (id, purpose_template_id) ON DELETE CASCADE,
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_annotation (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  "text": VARCHAR,
  urls: VARCHAR ARRAY,
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_annotation_document (
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  annotation_id UUID UNIQUE NOT NULL REFERENCES readmodel_purpose_template.purpose_template_annotation (id) ON DELETE CASCADE,
  "name" VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  "path" VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
