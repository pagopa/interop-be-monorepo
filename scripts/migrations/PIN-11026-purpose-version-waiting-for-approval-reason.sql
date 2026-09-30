-- Apply to existing readmodel databases before deploying readers or writers.
-- Historical versions stay NULL: their original quota decision cannot be inferred.
ALTER TABLE readmodel_purpose.purpose_version
  ADD COLUMN IF NOT EXISTS waiting_for_approval_reason VARCHAR;
