import { ApiError } from "pagopa-interop-models";
import { z } from "zod";
import { ErrorCodes } from "./errors.js";

export const Base64Encoded = z.string().base64().min(1);

export type ValidationResult<T> =
  | SuccessfulValidation<T>
  | FailedValidation<ErrorCodes>;

export type SuccessfulValidation<T> = { errors: undefined; data: T };
export type FailedValidation<T> = {
  errors: Array<ApiError<T>>;
  data: undefined;
};

export const ClientAssertionValidationRequest = z.object({
  client_id: z.string().optional(),
  client_assertion: z.string(),
  client_assertion_type: z.string(),
  grant_type: z.string(),
});

export type ClientAssertionValidationRequest = z.infer<
  typeof ClientAssertionValidationRequest
>;
