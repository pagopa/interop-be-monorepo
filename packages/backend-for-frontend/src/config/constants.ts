import {
  commonErrorCodes,
  serviceErrorCode,
  serviceName,
} from "pagopa-interop-models";

export const EVENT_CONFLICT_MAX_ATTEMPTS = 5;
export const EVENT_CONFLICT_RETRY_DELAY_MS = 1000;
export const CATALOG_EVENT_CONFLICT_CODE = `${
  serviceErrorCode[serviceName.CATALOG_PROCESS]
}-${commonErrorCodes.eventConflictError}`;
export const AUTHORIZATION_EVENT_CONFLICT_CODE = `${
  serviceErrorCode[serviceName.AUTHORIZATION_PROCESS]
}-${commonErrorCodes.eventConflictError}`;
