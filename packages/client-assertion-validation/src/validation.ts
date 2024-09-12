import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  verifyClientAssertionSignature,
  validateRequestParameters,
  verifyClientAssertion,
  validateClientKindAndPlatformState,
} from "./utils.js";
import { ApiKey, ConsumerKey, ValidationResult } from "./types.js";

export const validateClientAssertion = async (
  request: authorizationServerApi.AccessTokenRequest,
  key: ConsumerKey | ApiKey // TODO use just Key?
): Promise<ValidationResult> => {
  const parametersErrors = validateRequestParameters(request);

  const { errors: clientAssertionVerificationErrors, data: jwt } =
    verifyClientAssertion(request.client_assertion, request.client_id);

  const clientAssertionSignatureErrors = verifyClientAssertionSignature(
    request.client_assertion,
    key
  );

  if (
    parametersErrors ||
    clientAssertionVerificationErrors ||
    clientAssertionSignatureErrors
  ) {
    return {
      data: undefined,
      errors: [
        ...(parametersErrors || []),
        ...(clientAssertionVerificationErrors || []),
        ...(clientAssertionSignatureErrors || []),
      ],
    };
  }

  return validateClientKindAndPlatformState(key, jwt);
};
