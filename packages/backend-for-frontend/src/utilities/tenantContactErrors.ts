import { AxiosError, isAxiosError } from "axios";
import { logger } from "pagopa-interop-commons";
import { Problem } from "pagopa-interop-models";

import { TENANT_OPERATION_FORBIDDEN_CODE } from "../config/constants.js";
import { Headers } from "./context.js";

// Zodios diagnostics can contain the request or response body, including the address.
export function tenantContactRequestError(error: unknown): Error {
  const message = "Tenant contact request failed";
  return isAxiosError(error) && error.response
    ? new AxiosError(message, undefined, undefined, undefined, error.response)
    : new Error(message);
}

// A multi-tenant view can still be rendered when a contact is unavailable.
export const omitUnavailableTenantContact =
  (headers: Headers) =>
  (error: unknown): undefined => {
    if (!isAxiosError<Problem>(error)) {
      throw tenantContactRequestError(error);
    }
    const response = error.response;
    if (
      response?.status === 403 &&
      response.data?.errors?.some(
        ({ code }) => code === TENANT_OPERATION_FORBIDDEN_CODE
      )
    ) {
      return undefined;
    }
    if (response?.status === 404) {
      return undefined;
    }
    if (response && response.status < 500) {
      throw tenantContactRequestError(error);
    }
    logger({ correlationId: headers["X-Correlation-Id"] }).warn(
      `Unable to read tenant contact: ${response?.status ?? "no response"}`
    );
    return undefined;
  };
