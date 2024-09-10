import { authorizationServerApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { ApiError, clientKind } from "pagopa-interop-models";
import {
  verifyClientAssertionSignature,
  validateRequestParameters,
  assertValidPlatformState,
  verifyClientAssertion,
} from "./utils.js";
import { ApiKey, ConsumerKey } from "./types.js";
import { ErrorCodes } from "./errors.js";

export const assertValidClientAssertion = async (
  request: authorizationServerApi.AccessTokenRequest,
  key: ConsumerKey | ApiKey // Todo use just Key?
): Promise<Array<ApiError<ErrorCodes>>> => {
  const parametersErrors = validateRequestParameters(request);

  const { errors: clientAssertionVerificationErrors, data: jwt } =
    verifyClientAssertion(request.client_assertion, request.client_id);

  const clientAssertionSignatureErrors = verifyClientAssertionSignature(
    request.client_assertion,
    key
  );

  // todo exit here if there are any errors so far?

  if (ApiKey.safeParse(key).success) {
    return [
      ...parametersErrors,
      ...(clientAssertionVerificationErrors || []),
      ...clientAssertionSignatureErrors,
    ];
  }

  return match(key.clientKind)
    .with(clientKind.api, () => {
      const parsingErrors = !ApiKey.safeParse(key).success
        ? [Error("parsing")]
        : [];

      return [
        ...parsingErrors,
        ...parametersErrors,
        ...(clientAssertionVerificationErrors || []),
        ...clientAssertionSignatureErrors,
      ];
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
      return [
        ...errors,
        ...parametersErrors,
        ...(clientAssertionVerificationErrors || []),
        ...clientAssertionSignatureErrors,
      ];
    })
    .exhaustive();
};
