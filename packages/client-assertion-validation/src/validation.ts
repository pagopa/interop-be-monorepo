import { authorizationServerApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { clientKind } from "pagopa-interop-models";
import {
  verifyClientAssertionSignature,
  validateRequestParameters,
  assertValidPlatformState,
  verifyClientAssertion,
} from "./utils.js";
import { ApiKey, ConsumerKey, ValidationResult } from "./types.js";

export const assertValidClientAssertion = async (
  request: authorizationServerApi.AccessTokenRequest,
  key: ConsumerKey | ApiKey // Todo use just Key?
): Promise<ValidationResult> => {
  const parametersErrors = validateRequestParameters(request);

  const { errors: clientAssertionVerificationErrors, data: jwt } =
    verifyClientAssertion(request.client_assertion, request.client_id);

  const clientAssertionSignatureErrors = verifyClientAssertionSignature(
    request.client_assertion,
    key
  );

  // todo exit here if there are any errors so far?
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

  if (ApiKey.safeParse(key).success) {
    return { data: jwt, errors: undefined };
  }

  // todo complete the part below
  return match(key.clientKind)
    .with(clientKind.api, () => {
      const parsingErrors = !ApiKey.safeParse(key).success
        ? [Error("parsing")]
        : [];

      return [...parsingErrors];
    })
    .with(clientKind.consumer, () => {
      const errors: Error[] = [];
      if (ConsumerKey.safeParse(key).success) {
        // to do: useful?

        // eslint-disable-next-line functional/immutable-data
        errors.push(...assertValidPlatformState(key as ConsumerKey));
      } else {
        // eslint-disable-next-line functional/immutable-data
        errors.push(Error("parsing"));
      }
      return [...errors];
    })
    .exhaustive();
};
