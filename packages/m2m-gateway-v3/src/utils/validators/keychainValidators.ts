import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { unauthorizedError } from "pagopa-interop-models";
import { duplicatedUsersInProducerKeychainSeed } from "../../model/errors.js";

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

export function assertProducerKeychainUsersAreUnique(
  seed: m2mGatewayApiV3.ProducerKeychainSeed
) {
  const uniqueUsers = [...new Set(seed.members)];
  if (uniqueUsers.length !== seed.members.length) {
    throw duplicatedUsersInProducerKeychainSeed(seed.members);
  }
}
