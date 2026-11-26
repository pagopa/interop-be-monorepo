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

export const TENANT_OPERATION_FORBIDDEN_CODE = `${
  serviceErrorCode[serviceName.TENANT_PROCESS]
}-${commonErrorCodes.operationForbidden}`;

export const ASYNC_EXCHANGE_CALLBACK_INTERFACE_FOLDER =
  "asyncExchangeCallbackInterface";
