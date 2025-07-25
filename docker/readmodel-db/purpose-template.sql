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
  UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_eservice_descriptor_version (
  metadata_version INTEGER NOT NULL,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  eservice_id UUID, --> readmodel_catalog.eservice.id  
  eservice_descriptor_id UUID, --> readmodel_catalog.eservice_descriptor.id
  PRIMARY KEY (purpose_template_id, eservice_id),
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_risk_analysis_form (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  "version" VARCHAR NOT NULL,
  UNIQUE (purpose_template_id),
  PRIMARY KEY (id),
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_risk_analysis_answer (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template_risk_analysis_form (id) ON DELETE CASCADE,
  kind VARCHAR NOT NULL,
  "key" VARCHAR NOT NULL,
  "value" VARCHAR ARRAY NOT NULL,
  editable BOOLEAN NOT NULL,
  assistive_text VARCHAR,
  suggested_values VARCHAR ARRAY,
  PRIMARY KEY (id),
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_risk_analysis_answer_annotation (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  answer_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template_risk_analysis_answer (id) ON DELETE CASCADE,
  "text" VARCHAR,
  "urls" JSON,
  UNIQUE (answer_id),
  PRIMARY KEY (id),
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_purpose_template.purpose_template_risk_analysis_answer_annotation_document (
  id UUID,
  purpose_template_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template,
  metadata_version INTEGER NOT NULL,
  annotation_id UUID NOT NULL REFERENCES readmodel_purpose_template.purpose_template_risk_analysis_answer_annotation (id) ON DELETE CASCADE,
  "name" VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  "path" VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (purpose_template_id, metadata_version) REFERENCES readmodel_purpose_template.purpose_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
