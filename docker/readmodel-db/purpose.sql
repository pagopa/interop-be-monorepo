CREATE TABLE IF NOT EXISTS readmodel.purpose (
  id UUID,
  version INTEGER,
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

CREATE TABLE IF NOT EXISTS readmodel.purpose_version (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel.purpose (id) ON DELETE CASCADE,
  purpose_version INTEGER,
  -- beware: this refers to metadata
  state VARCHAR NOT NULL,
  -- riskAnalysis
  risk_analysis_id CHAR,
  risk_analysis_content_type VARCHAR,
  risk_analysis_path VARCHAR,
  risk_analysis_created_at TIMESTAMP,
  daily_calls INTEGER NOT NULL,
  rejection_reason VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  first_activation_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);
