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

const PURPOSE_PROCESS_ERROR_CODE =
  serviceErrorCode[serviceName.PURPOSE_PROCESS];
const PURPOSE_EVENT_CONFLICT_CODE = `${PURPOSE_PROCESS_ERROR_CODE}-${commonErrorCodes.eventConflictError}`;
export const PURPOSE_RISK_ANALYSIS_VERSION_MISMATCH_CODE = `${PURPOSE_PROCESS_ERROR_CODE}-0064`;
export const PURPOSE_RISK_ANALYSIS_SIGN_CONFLICT_CODES: readonly string[] = [
  `${PURPOSE_PROCESS_ERROR_CODE}-0049`,
  PURPOSE_RISK_ANALYSIS_VERSION_MISMATCH_CODE,
  PURPOSE_EVENT_CONFLICT_CODE,
];
export const PURPOSE_RISK_ANALYSIS_FORM_CONFLICT_CODES: readonly string[] = [
  `${PURPOSE_PROCESS_ERROR_CODE}-0054`,
  PURPOSE_EVENT_CONFLICT_CODE,
];

export const ASYNC_EXCHANGE_CALLBACK_INTERFACE_FOLDER =
  "asyncExchangeCallbackInterface";
