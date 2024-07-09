import {
  AccessTokenRequest,
  TokenGenerationValidationResult,
} from "../../../api-clients/dist/generated/bffApi.js";
import {
  invalidAssertionType,
  invalidGrantType,
} from "../model/domain/errors.js";

const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const CLIENT_CREDENTIAL_GRANT_TYPE = "client_credentials";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function toolServiceBuilder() {
  function validateRequestParamters(
    grantType: string,
    clientAssertionType: string
  ): void {
    if (grantType !== CLIENT_CREDENTIAL_GRANT_TYPE) {
      throw invalidGrantType(grantType);
    }

    if (clientAssertionType !== CLIENT_ASSERTION_TYPE) {
      throw invalidAssertionType(clientAssertionType);
    }
  }

  function validateClientAssertion(
    _clientAssertionType: string,
    _clientId: string | undefined
  ): TokenGenerationValidationResult {
    throw new Error("Function not implemented.");
  }
  return {
    validateTokenGeneration: async ({
      client_id: clientId,
      grant_type: grantType,
      client_assertion_type: clientAssertionType,
    }: AccessTokenRequest): Promise<TokenGenerationValidationResult> => {
      validateRequestParamters(grantType, clientAssertionType);

      return validateClientAssertion(clientAssertionType, clientId);
    },
  };
}
