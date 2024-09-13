import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  verifyClientAssertionSignature,
  validateRequestParameters,
  verifyClientAssertion,
  validateClientKindAndPlatformState,
  failedValidation,
  successfulValidation,
} from "./utils.js";
import {
  ApiKey,
  ClientAssertion,
  ConsumerKey,
  ValidationResult,
} from "./types.js";

export const validateClientAssertion = async (
  request: authorizationServerApi.AccessTokenRequest,
  key: ConsumerKey | ApiKey // TODO use just Key?
): Promise<ValidationResult<ClientAssertion>> => {
  const { errors: parametersErrors } = validateRequestParameters(request);

  const { errors: clientAssertionVerificationErrors, data: jwt } =
    verifyClientAssertion(request.client_assertion, request.client_id);

  const { errors: clientAssertionSignatureErrors } =
    verifyClientAssertionSignature(request.client_assertion, key);

  if (
    parametersErrors ||
    clientAssertionVerificationErrors ||
    clientAssertionSignatureErrors
  ) {
    return failedValidation([
      parametersErrors,
      clientAssertionVerificationErrors,
      clientAssertionSignatureErrors,
    ]);
  }
  const { errors: clientKindAndPlatormStateErrors } =
    validateClientKindAndPlatformState(key, jwt);

  if (clientKindAndPlatormStateErrors) {
    return failedValidation([clientAssertionSignatureErrors]);
  }

  return successfulValidation(jwt);
};
