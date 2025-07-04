import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { CorrelationId } from "pagopa-interop-models";
import { getSelfcareCompactUserById } from "../services/selfcareService.js";
import { SelfcareV2UserClient } from "../clients/clientsProvider.js";
import { assertClientVisibilityIsFull } from "../services/validators.js";

export const toBffApiCompactProducerKeychain = (
  input: authorizationApi.ProducerKeychain
): bffApi.CompactProducerKeychain => ({
  hasKeys: input.keys.length > 0,
  id: input.id,
  name: input.name,
});

export const toBffApiCompactClient = async (
  selfcareClient: SelfcareV2UserClient,
  { client, keys }: authorizationApi.ClientWithKeys,
  selfcareId: string,
  correlationId: CorrelationId
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
