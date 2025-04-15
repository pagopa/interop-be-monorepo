import { InternalError } from "pagopa-interop-models";

export const errorCodes = {
  insertStagingRecordsError: "INSERT_STAGING_RECORDS_ERROR",
  mergeDataError: "MERGE_DATA_ERROR",
  setupStagingTablesError: "SETUP_STAGING_TABLES_ERROR",
} as const;

export type ErrorCodes = keyof typeof errorCodes;

export function insertStagingRecordsError(
  detail: unknown
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Database error inserting staging records: ${JSON.stringify(
      detail
    )}`,
    code: "insertStagingRecordsError",
  });
}

export function mergeDataError(detail: unknown): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Database error merging data: ${JSON.stringify(detail)}`,
    code: "mergeDataError",
  });
}

export function setupStagingTablesError(
  detail: unknown
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Database error occurred while setting up staging tables. ${detail}`,
    code: "setupStagingTablesError",
  });
}
