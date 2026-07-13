import { InternalError } from "pagopa-interop-models";

type ErrorCodes =
  | "insertStagingRecordsError"
  | "mergeDataError"
  | "setupStagingTablesError"
  | "setupPartialStagingTablesError";

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
