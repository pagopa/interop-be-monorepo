import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { CorrelationId } from "pagopa-interop-models";
import { getSelfcareCompactUserById } from "../services/selfcareService.js";
import { SelfcareV2UserClient } from "../clients/clientsProvider.js";

export const toBffApiCompactProducerKeychain = (
  input: authorizationApi.ProducerKeychain
): bffApi.CompactProducerKeychain => ({
  hasKeys: input.keys.length > 0,
  id: input.id,
  name: input.name,
});

export const toBffApiCompactClient = async (
  selfcareClient: SelfcareV2UserClient,
  input: authorizationApi.ClientWithKeys,
  selfcareId: string,
  correlationId: CorrelationId
): Promise<bffApi.CompactClient> => ({
  hasKeys: input.keys.length > 0,
  id: input.client.id,
  name: input.client.name,
  admin: input.client.adminId
    ? await getSelfcareCompactUserById(
        selfcareClient,
        input.client.adminId,
        selfcareId,
        correlationId
      )
    : undefined,
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
