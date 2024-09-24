import { authorizationApi, bffApi } from "pagopa-interop-api-clients";

export const toBffApiCompactProducerKeychain = (
  input: authorizationApi.ProducerKeychain
): bffApi.CompactProducerKeychain => ({
  hasKeys: input.keys.length > 0,
  id: input.id,
  name: input.name,
});

export const toBffApiCompactClient = (
  input: authorizationApi.ClientWithKeys
): bffApi.CompactClient => ({
  hasKeys: input.keys.length > 0,
  id: input.client.id,
  name: input.client.name,
});

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
