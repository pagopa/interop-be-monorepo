import { InternalError } from "pagopa-interop-models";

const errorCodes = {
  insertStagingRecordsError: "INSERT_STAGING_RECORDS_ERROR",
  mergeDataError: "MERGE_DATA_ERROR",
  setupStagingTablesError: "SETUP_STAGING_TABLES_ERROR",
  setupPartialStagingTablesError: "SETUP_PARTIAL_STAGING_TABLES_ERROR",
} as const;

type ErrorCodes = keyof typeof errorCodes;

export function setupStagingTablesError(
  detail: unknown
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Database error occurred while setting up staging tables. ${detail}`,
    code: "setupStagingTablesError",
  });
}

export function setupPartialStagingTablesError(
  detail: unknown
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Database error occurred while setting up partial staging tables. ${detail}`,
    code: "setupPartialStagingTablesError",
  });
}
