import { authorizationServerApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { clientKind } from "pagopa-interop-models";
import {
  verifyClientAssertionSignature,
  validateRequestParameters,
  assertValidPlatformState,
  verifyClientAssertion,
} from "./utils.js";
import { ApiKey, ClientAssertion, ConsumerKey } from "./types.js";

export const assertValidClientAssertion = async (
  request: authorizationServerApi.AccessTokenRequest,
  key: ConsumerKey | ApiKey // To do use just Key?
): Promise<ClientAssertion> => {
  validateRequestParameters(request);

  const clientAssertionJWT = verifyClientAssertion(
    request.client_assertion,
    request.client_id
  );

  verifyClientAssertionSignature(request.client_assertion, key);

  if (ApiKey.safeParse(key).success) {
    return clientAssertionJWT;
  }

  match(key.clientKind)
    .with(clientKind.api, () => {
      if (!ApiKey.safeParse(key).success) {
        // to do: useful?

        throw Error("parsing");
      }
      return true;
    })
    .with(clientKind.consumer, () => {
      if (ConsumerKey.safeParse(key).success) {
        // to do: useful?

        assertValidPlatformState(key as ConsumerKey);
      } else {
        throw Error("parsing");
      }
      return true;
    })
    .exhaustive();

  return clientAssertionJWT;
};
