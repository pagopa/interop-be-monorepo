import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { CorrelationId } from "pagopa-interop-models";
import { SelfcareV2UsersClient } from "pagopa-interop-api-clients";
import { getSelfcareCompactUserById } from "../services/selfcareService.js";
import {
  assertClientVisibilityIsFull,
  assertProducerKeychainVisibilityIsFull,
} from "../services/validators.js";

export const toBffApiCompactProducerKeychain = (
  keychain: authorizationApi.ProducerKeychain
): bffApi.CompactProducerKeychain => {
  assertProducerKeychainVisibilityIsFull(keychain);
  return {
    hasKeys: keychain.keys.length > 0,
    id: keychain.id,
    name: keychain.name,
  };
};

export const toBffApiCompactClient = async (
  selfcareClient: SelfcareV2UsersClient,
  { client, keys }: authorizationApi.ClientWithKeys,
  selfcareId: string,
  correlationId: CorrelationId,
  hasNotifications?: boolean
): Promise<bffApi.CompactClient> => {
  assertClientVisibilityIsFull(client);
  return {
    hasKeys: keys.length > 0,
    id: client.id,
    name: client.name,
    admin: client.adminId
      ? await getSelfcareCompactUserById(
          selfcareClient,
          client.adminId,
          selfcareId,
          correlationId
        )
      : undefined,
    hasUnreadNotifications: hasNotifications || false,
  };
};

export function toAuthorizationKeySeed(
  seed: bffApi.KeySeed
): authorizationApi.KeySeed {
  return {
    key: seed.key,
    use: seed.use,
    alg: seed.alg,
    name: seed.name,
  };
}
