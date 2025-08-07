import { authorizationApi } from "pagopa-interop-api-clients";
import { unauthorizedError } from "pagopa-interop-models";

export function assertProducerKeychainVisibilityIsFull(
  keychain: authorizationApi.ProducerKeychain
): asserts keychain is authorizationApi.ProducerKeychain & {
  visibility: typeof authorizationApi.Visibility.Values.FULL;
} {
  if (keychain.visibility !== authorizationApi.Visibility.Values.FULL) {
    throw unauthorizedError(
      `Tenant is not the owner of the producer keychain with id ${keychain.id}`
    );
  }
}
