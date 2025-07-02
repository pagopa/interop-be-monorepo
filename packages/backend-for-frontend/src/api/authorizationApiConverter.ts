import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { CorrelationId } from "pagopa-interop-models";
import { match } from "ts-pattern";
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
  { client, keys }: authorizationApi.ClientWithKeys,
  selfcareId: string,
  correlationId: CorrelationId
): Promise<bffApi.CompactClient> =>
  match(client)
    .with(
      { visibility: authorizationApi.ClientVisibility.Enum.FULL },
      async (client) => ({
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
      })
    )
    .with(
      { visibility: authorizationApi.ClientVisibility.Enum.COMPACT },
      () => ({
        hasKeys: keys.length > 0,
        id: client.id,
      })
    )
    .exhaustive();

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
