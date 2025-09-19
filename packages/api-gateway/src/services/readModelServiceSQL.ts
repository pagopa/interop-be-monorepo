/* eslint-disable fp/no-delete */
import { eq } from "drizzle-orm";
import { apiGatewayApi } from "pagopa-interop-api-clients";
import {
  genericInternalError,
  ClientJWKKey,
  ProducerJWKKey,
} from "pagopa-interop-models";
import {
  ClientJWKKeyReadModelService,
  ProducerJWKKeyReadModelService,
} from "pagopa-interop-readmodel";
import {
  clientJwkKeyInReadmodelClientJwkKey,
  producerJwkKeyInReadmodelProducerJwkKey,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  clientJWKKeyReadModelService: ClientJWKKeyReadModelService,
  producerJWKKeyReadModelService: ProducerJWKKeyReadModelService
) {
  return {
    getJWKById: async (
      kId: ClientJWKKey["kid"] | ProducerJWKKey["kid"]
    ): Promise<apiGatewayApi.JWK | undefined> => {
      const [key, producerKey] = await Promise.all([
        clientJWKKeyReadModelService.getClientJWKKeyByFilter(
          eq(clientJwkKeyInReadmodelClientJwkKey.kid, kId)
        ),
        producerJWKKeyReadModelService.getProducerJWKKeyByFilter(
          eq(producerJwkKeyInReadmodelProducerJwkKey.kid, kId)
        ),
      ]);

      const data: apiGatewayApi.JWK | undefined =
        key?.data ?? producerKey?.data;

      if (data) {
        if ("clientId" in data) {
          delete data?.clientId;
        }
        if ("producerKeychainId" in data) {
          delete data?.producerKeychainId;
        }

        const result = apiGatewayApi.JWK.safeParse(data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse JWKKey item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }
      return undefined;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
