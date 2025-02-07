CREATE TABLE IF NOT EXISTS readmodel.purpose (
  id UUID,
  metadata_version INTEGER NOT NULL,
  eservice_id UUID NOT NULL,
  consumer_id UUID NOT NULL,
  delegation_id UUID,
  -- versions
  suspended_by_consumer TIMESTAMP WITH TIME ZONE,
  suspended_by_producer TIMESTAMP WITH TIME ZONE,
  title VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  -- riskAnalysisForm
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_free_of_charge BOOLEAN NOT NULL,
  free_of_charge_reason BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.purpose_risk_analysis_form (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version INTEGER NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.purpose_risk_analysis_answer(
  id UUID,
  purpose_id UUID REFERENCES readmodel.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID REFERENCES readmodel.purpose_risk_analysis_form (id),
  kind VARCHAR,
  -- SINGLE/MULTI
  key VARCHAR,
  value VARCHAR ARRAY,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel.purpose_version (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel.purpose (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  -- beware: this refers to metadata
  state VARCHAR NOT NULL,
  -- riskAnalysis
  daily_calls INTEGER NOT NULL,
  rejection_reason VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  first_activation_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.purpose_version_document (
  purpose_id uuid REFERENCES readmodel.purpose(id) ON DELETE CASCADE,
  metadata_version integer NOT NULL,
  purpose_version_id uuid REFERENCES readmodel.purpose_version(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
);
