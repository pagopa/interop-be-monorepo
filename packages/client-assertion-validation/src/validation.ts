import { z } from "zod";
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
  request: ClientAssertionValidationRequest,
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

const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // TODO: env?
const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // TODO: env?

export const ClientAssertionValidationRequest = z.object({
  client_id: z.optional(z.string().uuid()),
  client_assertion: z.string(),
  client_assertion_type: z.literal(EXPECTED_CLIENT_ASSERTION_TYPE),
  grant_type: z.literal(EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE),
});

export type ClientAssertionValidationRequest = z.infer<
  typeof ClientAssertionValidationRequest
>;
